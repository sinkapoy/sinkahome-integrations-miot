import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
 
export default [
    {
        input: 'src/index.ts',
        output: [
            {
                dir: './dist/',
                format: 'es',
                sourcemap: true,
            }
        ],
        plugins: [
            json(),
            typescript({
                tsconfig: 'tsconfig.json',
                useTsconfigDeclarationDir: true,
                tsconfigOverride: {
                    declaration: false,
                }
            }),
            commonjs({ 
                extensions: ['.js'],
                include: /node_modules/
            }),
            nodeResolve({
                exportConditions: ['default', 'module', 'import'],
                mainFields: ['main','module', 'jsnext:main'],
                dedupe: ['node:buffer', 'buffer']
            }),
            
            
        ],
        external: [
            '@ash.ts/ash',
            '@sinkapoy/home-core',
            '@sinkapoy/home-integrations-networking',
            'randomstring',
            'fs',
            'fs/promises',
            'dgram',
            'crypto',
            'url',
            'eventemitter3',
            'querystring',
            // /node_modules/,
        ]
    },
    // {
    //     input: 'src/tests.ts',
    //     output: [
    //         {
    //             file: 'dist/tests.js',
    //             format: 'cjs',
    //             sourcemap: false,
    //         }
    //     ],
    //     plugins: [
    //         json(),
    //         typescript({
    //             tsconfig: 'tsconfig.json',
    //             useTsconfigDeclarationDir: true,
    //             tsconfigOverride: {
    //                 declaration: false,
    //             }
    //         }),
    //         nodeResolve({ preferBuiltins: true, }),
    //         commonjs({ extensions: ['.js', '.ts'] }),
            
    //     ],
    // }
];