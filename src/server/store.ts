import { type MiCloudAccountProvider } from './MiCloudAccountProvider';

export const miotPluginStore = {
    accounts: {} as Record<string, MiCloudAccountProvider>,
};
