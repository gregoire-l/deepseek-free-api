import fs from 'fs-extra';
import { chromium } from 'playwright';
import Response from '@/lib/response/Response.ts';
import FailureBody from '@/lib/response/FailureBody.ts';
import APIException from '@/lib/exceptions/APIException.ts';
import EX from '@/api/consts/exceptions.ts';
import logger from '@/lib/logger.ts';

const ACCOUNTS_FILE = 'data/accounts.json';

// Ensure accounts file exists
if (!fs.existsSync('data')) {
  fs.mkdirSync('data');
}
if (!fs.existsSync(ACCOUNTS_FILE)) {
  fs.writeJsonSync(ACCOUNTS_FILE, { accounts: [] });
}

async function getAccounts() {
  const data = await fs.readJson(ACCOUNTS_FILE);
  return data.accounts.map((account: any) => ({
    id: account.id,
    email: account.email.replace(/(?<=.{3}).(?=.*@)/g, '*'), // Mask email
    lastUpdate: account.lastUpdate
  }));
}

async function addAccount(email: string, password: string, progressCallback: (step: string) => void) {
  progressCallback('Démarrage du navigateur...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    progressCallback('Connexion au compte Deepseek...');
    await page.goto('https://chat.deepseek.com/auth/login');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    progressCallback('Récupération des cookies...');
    const cookies = await context.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    progressCallback('Enregistrement du compte...');
    const data = await fs.readJson(ACCOUNTS_FILE);
    const accountData = {
      id: Date.now().toString(),
      email,
      cookies: cookieString,
      lastUpdate: new Date().toISOString()
    };
    
    data.accounts = data.accounts.filter((acc: any) => acc.email !== email);
    data.accounts.push(accountData);
    await fs.writeJson(ACCOUNTS_FILE, data, { spaces: 2 });

    progressCallback('Compte ajouté avec succès !');
    return accountData;
  } finally {
    await browser.close();
  }
}

export default {
  get: {
    '/accounts': async () => {
      const content = await fs.readFile('public/accounts.html');
      return new Response(content, { type: 'html' });
    },
    '/accounts/list': async () => {
      const accounts = await getAccounts();
      return new Response({ accounts });
    },
    '/accounts/add': async () => {
      const content = await fs.readFile('public/add-account.html');
      return new Response(content, { type: 'html' });
    }
  },
  post: {
    '/accounts/add': async (req: Request) => {
      const { email, password } = await req.json();
      
      if (!email || !password) {
        throw new APIException(EX.API_REQUEST_PARAMS_INVALID, 'Email and password are required');
      }

      const stream = new TransformStream();
      const writer = stream.writable.getWriter();
      const encoder = new TextEncoder();

      // Start the account addition process in the background
      (async () => {
        try {
          await addAccount(email, password, async (step) => {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ step })}\n\n`));
          });
          await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          logger.error('Failed to add account:', error);
          await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
        } finally {
          await writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: new Headers({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        })
      });
    }
  }
}; 