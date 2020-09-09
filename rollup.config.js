import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import pkg from './package.json';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import { version as runtimeVersion } from '@babel/runtime/package.json';

const externals = new Set([...Object.keys(pkg.dependencies || {})]);

export default process.env.NODE_ENV !== 'test'
  ? {
      external: (id) =>
        externals.has(id) || id.startsWith('@babel/runtime/') || id.startsWith('lodash/'),
      input: './src/core.js',
      plugins: [
        json({ include: 'package.json' }),
        babel({
          babelHelpers: 'runtime',

          plugins: [
            'babel-plugin-transform-undefined-to-void',
            'babel-plugin-lodash',
            [
              '@babel/plugin-transform-runtime',
              {
                version: runtimeVersion,
                useESModules: true,
              },
            ],

            ['@babel/plugin-proposal-class-properties', { loose: true }],
          ],
        }),
        replace({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
      ],
      output: [
        {
          file: './neckbone.es.js',
          format: 'es',
        },
        {
          file: './neckbone.cjs.js',
          format: 'cjs',
        },
      ],
    }
  : {
      external: ['lodash'],
      input: './test/main.js',
      plugins: [
        json({ include: 'package.json' }),
        commonjs({
          include: ['node_modules/@babel/runtime/**', 'node_modules/core-js/**'],
        }),
        resolve({
          browser: true,
          preferBuiltins: false,
        }),
        babel({
          babelHelpers: 'bundled',

          presets: [['@babel/preset-env', { targets: { node: 3 } }]],

          plugins: [
            'babel-plugin-transform-undefined-to-void',
            ['@babel/plugin-proposal-class-properties', { loose: true }],
          ],
        }),
        replace({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
      ],
      output: {
        file: './neckbone.js',
        format: 'iife',
        globals: { lodash: '_' },
        name: 'Backbone',
      },
    };
