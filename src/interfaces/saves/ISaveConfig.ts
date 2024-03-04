export interface ISaveConfig {
    accounts: {
        username: string;
        password: string;
        locale: string;
        country: string;
        clientId: string;
        agentId: string;
    }[];
}