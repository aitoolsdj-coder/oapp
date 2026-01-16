const API = {
    ENDPOINTS: {
        REQ_LIST: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/zapotrzebowania/list',
        REQ_ADD: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/zapotrzebowania/add',
        REQ_STATUS: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/zapotrzebowania/status',
        Q_LIST: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/pytania/list',
        Q_ADD: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/pytania/add',
        Q_STATUS: 'https://jakubdworak.app.n8n.cloud/webhook/oapp/pytania/status'
    },

    async _get(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async _post(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async getRequirements() {
        return this._get(this.ENDPOINTS.REQ_LIST);
    },

    async addRequirement(data) {
        return this._post(this.ENDPOINTS.REQ_ADD, data);
    },

    async updateRequirementStatus(id, status) {
        return this._post(this.ENDPOINTS.REQ_STATUS, { id, status });
    },

    async getQuestions() {
        return this._get(this.ENDPOINTS.Q_LIST);
    },

    async addQuestion(data) {
        return this._post(this.ENDPOINTS.Q_ADD, data);
    },

    async updateQuestionStatus(id, status) {
        return this._post(this.ENDPOINTS.Q_STATUS, { id, status });
    }
};
