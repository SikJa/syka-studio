/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const WebFonts = {
	// Bundled OFL fonts: the BridgeClip presets also work without Google Fonts.
	'Montserrat ExtraBold': {
		weights: ['800'],
		url: new URL('./assets/Montserrat-ExtraBold.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Montserrat-OFL.txt', import.meta.url).href,
	},
	'Instrument Serif': {
		weights: ['400'],
		style: 'italic',
		url: new URL('./assets/InstrumentSerif-Italic.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/InstrumentSerif-OFL.txt', import.meta.url).href,
	},
	'Archivo Black': {
		weights: ['400'],
		url: new URL('./assets/ArchivoBlack-Regular.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/ArchivoBlack-OFL.txt', import.meta.url).href,
	},
	'Poppins Black': {
		weights: ['900'],
		url: new URL('./assets/Poppins-Black.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Poppins-OFL.txt', import.meta.url).href,
	},
	Inter: {
		weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
		url: new URL('./assets/inter.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Inter-OFL.txt', import.meta.url).href,
	},
	Geologica: {
		weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
		url: new URL('./assets/geologica.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Geologica-OFL.txt', import.meta.url).href,
	},
	Nunito: {
		weights: ['200', '300', '400', '500', '600', '700', '800', '900'],
		url: new URL('./assets/nunito.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Nunito-OFL.txt', import.meta.url).href,
	},
	Figtree: {
		weights: ['300', '400', '500', '600', '700', '800', '900'],
		url: new URL('./assets/figtree.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Figtree-OFL.txt', import.meta.url).href,
	},
	Urbanist: {
		weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
		url: new URL('./assets/urbanist.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Urbanist-OFL.txt', import.meta.url).href,
	},
	Montserrat: {
		weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
		url: new URL('./assets/montserrat.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Montserrat-OFL.txt', import.meta.url).href,
	},
	Bangers: {
		weights: ['400'],
		url: new URL('./assets/bangers.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Bangers-OFL.txt', import.meta.url).href,
	},
	Chewy: {
		weights: ['400'],
		url: new URL('./assets/chewy.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/Chewy-LICENSE.txt', import.meta.url).href,
	},
	'Source Code Pro': {
		weights: ['200', '300', '400', '500', '600', '700', '800', '900'],
		url: new URL('./assets/sourcecodepro.ttf', import.meta.url).href,
		licenseUrl: new URL('./assets/SourceCodePro-OFL.txt', import.meta.url).href,
	},
} as const;

export const FONT_WEIGHTS = {
	'100': 'Thin',
	'200': 'Extra Light',
	'300': 'Light',
	'400': 'Normal',
	'500': 'Medium',
	'600': 'Semi Bold',
	'700': 'Bold',
	'800': 'Extra Bold',
	'900': 'Black',
} as const;
