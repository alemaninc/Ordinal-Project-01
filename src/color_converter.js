/*
Adapted from xhwzwka's Color Converter.
https://xhwzwka.github.io/Color-Converter/
*/

import { modulo } from "./utility.js";

export function rgbtohex(r,g,b) {
	r = Math.round(r);
	g = Math.round(g);
	b = Math.round(b);

	if (r<16) {
		var rh = "0"+r.toString(16);
	} else {
		var rh = r.toString(16);
	}

	if (g<16) {
		var gh = "0"+g.toString(16);
	} else {
		var gh = g.toString(16);
	}

	if (b<16) {
		var bh = "0"+b.toString(16);
	} else {
		var bh = b.toString(16);
	}

	var hex = "#"+rh+gh+bh;
	return [hex];
}

function hsltorgb(h,s,l) {
	h = modulo(h, 360);
	s = s/100;
	l = l/100;

	var val = (1-Math.abs(2*l-1))*s;
	var val2 = val*(1-Math.abs((h/60)%2 - 1));
	var diff = l - val/2;

	if ((0<=h && h<60) || h==360) {
		var r = val;
		var g = val2;
		var b = 0;
	} else if (60<=h && h<120) {
		var r = val2;
		var g = val;
		var b = 0;
	} else if (120<=h && h<180) {
		var r = 0;
		var g = val;
		var b = val2;
	} else if (180<=h && h<240) {
		var r = 0;
		var g = val2;
		var b = val;
	} else if (240<=h && h<300) {
		var r = val2;
		var g = 0;
		var b = val;
	} else if (300<=h && h<360) {
		var r = val;
		var g = 0;
		var b = val2;
	}

	r = (r+diff)*255;
	g = (g+diff)*255;
	b = (b+diff)*255;

	r = Math.max(0,Math.floor(r));
	g = Math.max(0,Math.floor(g));
	b = Math.max(0,Math.floor(b));
	return [r,g,b];
}

export function hsltohex(h, s, l) {
	return rgbtohex(...hsltorgb(h, s, l))[0];
}