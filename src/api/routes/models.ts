import _ from 'lodash';

export default {

    prefix: '/v1',

    get: {
        '/models': async () => {
            return {
                "data": [
                    {
                        "id": "deepseek-chat",
                        "object": "model",
                        "owned_by": "deepseek-free-api",
                        "context_length": 128000,
                    },
                    {
                        "id": "deepseek-coder",
                        "object": "model",
                        "owned_by": "deepseek-free-api",
                        "context_length": 128000,
                    },
                    {
                        "id": "deepseek-r1",
                        "object": "model",
                        "owned_by": "deepseek-free-api",
                        "context_length": 128000,
                    },
                    {
                        "id": "deepseek-search",
                        "object": "model",
                        "owned_by": "deepseek-free-api",
                        "context_length": 128000,
                    },
                    {
                        "id": "deepseek-think",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-r1",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-search",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-r1-search",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-think-search",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-r1-silent",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-search-silent",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-think-fold",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    },
                    {
                        "id": "deepseek-r1-fold",
                        "object": "model",
                        "owned_by": "deepseek-free-api"
                    }
                ]
            };
        }

    }
}
