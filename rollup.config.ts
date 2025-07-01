import typescript from 'rollup-plugin-typescript2';
import vue from 'rollup-plugin-vue';
import images from '@rollup/plugin-image';
import copy from 'rollup-plugin-copy';
import styles from 'rollup-plugin-styler';

const external = [
    '@ash.ts/ash',
    '@sinkapoy/home-core',
    '@sinkapoy/home-integrations-networking',
    'randomstring',
    'fs',
    'fs/promises',
    'node-fetch',
    'ts-deferable',
    '@sinkapoy/home-integrations-server-widgets',
    '@sinkapoy/home-integrations-commands',
    'dgram',
    'crypto',
    'url',
    'eventemitter3',
    'querystring',
    '@sinkapoy/home-integrations-vue-components',
    'vue',
    /^(?!.*inject-css.js).*node_modules\/(.+)$/,
];

const config = {
    plugins: [
        typescript({
            tsconfig: 'tsconfig.json',
            useTsconfigDeclarationDir: true,
            tsconfigOverride: {
                declaration: false,
            }
        }),
        vue({preprocessStyles: true}),
        styles(),
        images({dom: false}),
    ],
    external,
};

export default [
    {
        input: 'src/serverIndex.ts',
        output: [
            {
                dir: './dist/',
                format: 'es',
                sourcemap: true,
            }
        ],
        ...config,
    },
    {
        input: 'src/browserIndex.ts',
        output: [
            {
                dir: './dist/',
                format: 'es',
                sourcemap: true,
            }
        ],
        ...config,
    },
];