import { EventEmitter } from 'events';
import logger from '@/lib/logger.ts';
import APIException from '@/lib/exceptions/APIException.ts';
import EX from '@/api/consts/exceptions.ts';
import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import axios, { AxiosHeaders } from 'axios';
import setCookie from 'set-cookie-parser';

// Ordre exact des headers tel qu'envoyé par Chromium
const BASE_HEADER_ORDER = [
    'accept',
    'accept-language',
    'cache-control',
    'pragma',
    'priority',
    'sec-ch-ua',
    'sec-ch-ua-arch',
    'sec-ch-ua-bitness',
    'sec-ch-ua-full-version',
    'sec-ch-ua-full-version-list',
    'sec-ch-ua-mobile',
    'sec-ch-ua-model',
    'sec-ch-ua-platform',
    'sec-ch-ua-platform-version',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'sec-fetch-user',
    'cookie',
    'upgrade-insecure-requests',
    'user-agent',
    'referer',
    'origin',
    'Cookie'
] as string[];

// Headers de base pour toutes les requêtes
const BASE_HEADERS = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'priority': 'u=0, i',
    'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
    'sec-ch-ua-arch': '"x86"',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-full-version': '"132.0.6834.159"',
    'sec-ch-ua-full-version-list': '"Not A(Brand";v="8.0.0.0", "Chromium";v="132.0.6834.159"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-model': '""',
    'sec-ch-ua-platform': '"Linux"',
    'sec-ch-ua-platform-version': '"6.8.0"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'referer': 'https://chat.deepseek.com/',
    'origin': 'https://chat.deepseek.com'
} as const;

// Ordre exact des cookies tel qu'envoyé par Chromium
const COOKIE_ORDER = [
    'Hm_lvt_fb5acee01d9182aabb2b61eb816d24ff',
    'smidV2',
    'Hm_lvt_1fff341d7a963a4043e858ef0e19a17c',
    'cf_clearance',
    'HWWAFSESID',
    'HWWAFSESTIME',
    'ds_session_id',
    '__cf_bm',
    '.thumbcache_6b2e5483f9d858d7c661c5e276b6a6ae',
    'intercom-device-id-guh50jw4',
    'intercom-session-guh50jw4'
] as string[];

const INITIAL_COOKIES = '{"Hm_lvt_fb5acee01d9182aabb2b61eb816d24ff":"1737904343","smidV2":"2025012616124421f63fed18f30fba5fc2e1edbb669f0100af11e6452773d40","Hm_lvt_1fff341d7a963a4043e858ef0e19a17c":"1737904365,1738345128,1738346165,1738346260","cf_clearance":"Niulwn11ymX_4MpiifW2K.4w_eO.a.irRNuuFdOzQPk-1739114859-1.2.1.1-a3RTFgoAPOZAgbaFFpOdp2Vi3bbFMXFb10jPpHsItFVjhtevs_sG7HlnNqKTM4TT5t7vSReN3TViuViDXnKyxki7.ywQfFV9VycCYCLVz894E7ZPNIRWb3Wwv3N7sYY3Os_3MZgTNb9uFR1e3ugFT_gYlAs4tY7rxtI2HIR.qAqJ4l0ub.E5CpVJsivlAXI7Nuds8cNr0KhRSUwKRlMy.rDhPKQqYB3Lk9SCQd4CkuB5VRvKiPIxuuTpX4xRdDp6s54Z4qRjUE.iVgeZbZof12qyow7Sl87l.LbGZHxYFRVYtqv.iVndG4fQ7_RZLpXdr2PRR55bJkEIEcsfRXBTOQ",".thumbcache_6b2e5483f9d858d7c661c5e276b6a6ae":"DBKIAtgggIVlQafNgGZwnQxadrYER0E8ieYytro2Q/k1mUTMOC5rn/IDViiZB+EtFDaMu3g4sgs+MCSf0QsXSg%3D%3D","intercom-device-id-guh50jw4":"36d75c24-d276-4857-adbc-789cb21d3825","intercom-session-guh50jw4":"ellyZXFpS0hrRFNiZXJxNGhDZWhncSs3VDhxM2NqQnNheTN3UTJXWlE5WnV2ZllmdFJROU16L1pVUXFheWZ2MzUwcU9LYVRYcWxheWRtam1sVWZDcXFFZWttNSsvQ0lWZzFZSHBIbG5BcWM9LS1WY2NGajVlQjY3eDVSNFhjN0tCaWJBPT0"}';

export class CloudflareAuth extends EventEmitter {
  private credentials = {
    userToken: '',
    cookies: {} as Record<string, string>,
    headers: {}
  };

  constructor() {
    super();
    this.setupAxiosInterceptors();
    this.credentials.cookies = JSON.parse(INITIAL_COOKIES);
    this.refreshDynamicCookies(); // Rafraîchir les cookies dynamiques à l'initialisation
  }

  private setupAxiosInterceptors() {
    axios.interceptors.request.use((config) => {
      if (config.headers) {
        // Créer un objet pour stocker les headers finaux
        const finalHeaders: Record<string, string> = {};
        
        // Préparer le cookie string une seule fois et enlever les guillemets
        const cookieString = this.getCookieString().replace(/^'|'$/g, '');
        
        // 1. D'abord ajouter les headers de base dans l'ordre spécifié
        BASE_HEADER_ORDER.forEach(headerKey => {
          const lowerKey = headerKey.toLowerCase();
          if (lowerKey === 'cookie') {
            finalHeaders['cookie'] = cookieString;  // Utiliser la casse exacte de cURL
          } else if (headerKey in BASE_HEADERS) {
            finalHeaders[lowerKey] = BASE_HEADERS[headerKey];
          }
        });

        // 2. Créer le nouvel objet AxiosHeaders avec les headers finaux
        config.headers = new AxiosHeaders(finalHeaders);

        // Log pour vérification
        logger.debug('Final request headers:', {
          headers: finalHeaders
        });
      }
      return config;
    });

    // Interceptor pour les réponses - gestion des cookies
    axios.interceptors.response.use(
      (response) => {
        if (response.headers['set-cookie']) {
          const newCookies = setCookie.parse(response.headers['set-cookie']);
          newCookies.forEach(cookie => {
            this.updateCookie(cookie.name, cookie.value);
            logger.debug(`Processed cookie from response: ${cookie.name}`);
          });
        }
        return response;
      },
      (error) => {
        if (error.response?.headers['set-cookie']) {
          const newCookies = setCookie.parse(error.response.headers['set-cookie']);
          newCookies.forEach(cookie => {
            this.updateCookie(cookie.name, cookie.value);
            logger.debug(`Processed cookie from error response: ${cookie.name}`);
          });
        }
        return Promise.reject(error);
      }
    );
  }

  private refreshDynamicCookies() {
    const timestamp = Date.now();
    
    // Mise à jour des cookies temporels
    this.credentials.cookies['HWWAFSESTIME'] = timestamp.toString();
    this.credentials.cookies['HWWAFSESID'] = this.generateHWWAFSESID();
    this.credentials.cookies['ds_session_id'] = this.generateSessionId();
    
    logger.debug('Dynamic cookies refreshed:', {
      HWWAFSESTIME: this.credentials.cookies['HWWAFSESTIME'],
      HWWAFSESID: this.credentials.cookies['HWWAFSESID'],
      ds_session_id: this.credentials.cookies['ds_session_id']
    });
  }

  private generateHWWAFSESID(): string {
    return Array.from({ length: 18 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private generateSessionId(): string {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  public getCookieString(): string {
    // Rafraîchir les cookies dynamiques avant de construire la chaîne
    this.refreshDynamicCookies();
    
    // Construire la chaîne de cookies dans l'ordre exact
    return COOKIE_ORDER
      .map(name => {
        if (name in this.credentials.cookies) {
          return `${name}=${this.credentials.cookies[name]}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('; ');
  }

  async init() {
    try {
      logger.info('Initializing Cloudflare authentication');
      await this.verifyCloudflareBypass();
    } catch (error) {
      logger.error('Cloudflare auth initialization failed:', error);
      throw new APIException(EX.API_REQUEST_FAILED, 'Failed to initialize Cloudflare auth');
    }
  }

  private async verifyCloudflareBypass(): Promise<boolean> {
    try {
      logger.info('Attempting to verify Cloudflare bypass...');
      
      // Log de la requête exacte qui va être envoyée
      logger.debug('Sending request with exact headers:', {
        url: 'https://chat.deepseek.com/',
        headers: BASE_HEADER_ORDER.reduce((acc, key) => {
          if (key === 'Cookie') {
            acc[key] = this.getCookieString();
          } else if (key in BASE_HEADERS) {
            acc[key] = BASE_HEADERS[key];
          }
          return acc;
        }, {} as Record<string, string>)
      });
      
      const response = await axios.get('https://chat.deepseek.com/', {
        validateStatus: (status) => true,
        maxRedirects: 5,
        timeout: 30000
      });

      // Log détaillé de la réponse
      logger.debug('Response status:', response.status);
      logger.debug('Response headers:', JSON.stringify(response.headers, null, 2));
      
      if (response.status !== 200) {
        logger.error('Non-200 response received:', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        throw new Error(`Failed to bypass Cloudflare. Status code: ${response.status}`);
      }

      // Vérification du contenu de la réponse
      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      logger.debug('Response content preview:', responseText.substring(0, 500));

      if (!responseText.includes('root') && !responseText.includes('DeepSeek')) {
        logger.error('Expected content not found in response');
        throw new Error('Failed to bypass Cloudflare. Expected content not found');
      }

      logger.info('Successfully bypassed Cloudflare protection');
      return true;
    } catch (error) {
      logger.error('Cloudflare bypass verification failed:', error);
      if (error.response) {
        logger.error('Error response:', {
          status: error.response.status,
          headers: error.response.headers,
          data: error.response.data
        });
      }
      throw error;
    }
  }

  getHeaders() {
    return BASE_HEADERS;
  }

  updateCookie(name: string, value: string) {
    try {
      // Liste des cookies à mettre à jour systématiquement
      const IMPORTANT_COOKIES = [
        'cf_', '__cf',  // Cookies Cloudflare
        'HWWAFSES',     // Cookies HWWAFSES
        'ds_session',   // Cookie de session DeepSeek
        'intercom'      // Cookies Intercom
      ];

      // Vérifier si le cookie doit être mis à jour
      const shouldUpdate = IMPORTANT_COOKIES.some(prefix => name.toLowerCase().includes(prefix.toLowerCase()));
      
      if (shouldUpdate) {
        this.credentials.cookies[name] = value;
        logger.debug(`Cookie ${name} updated successfully with value: ${value}`);
      }
    } catch (error) {
      logger.error(`Error updating cookie ${name}:`, error);
    }
  }
} 