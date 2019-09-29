
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';


// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false
const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/app.js',
	output: {
		file: 'public/bundle.js',
		format: 'iife', // immediately-invoked function expression — suitable for <script> tags
		sourcemap: !production
	},
	plugins: [
	//	async(),
		resolve(), // tells Rollup how to find three.js in node_modules
		commonjs(), // converts three.js to ES modules
		production && terser() // minify, but only in production
	]
};
