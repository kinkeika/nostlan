let sysMapForAndy = {
	wiiu: 'Nintendo Wii U',
	'3ds': 'Nintendo 3DS',
	ds: 'Nintendo DS',
	ps3: 'Sony PlayStation 3',
	ps2: 'Sony PlayStation 2',
	xbox360: 'Xbox 360',
	gba: 'Game Boy Advance',
	wii: 'Nintendo Wii',
	gcn: 'Nintendo Game Cube',
	n64: 'Nintendo 64',
	snes: 'Super Nintendo',
	nes: 'Nintendo'
};
const dl = require('./dl.js');

async function dlFromAndy(title, dir, sys) {
	sys = sysMapForAndy[sys];
	let url = `http://andydecarli.com/Video Games/Collection/${sys}/Scans/Full Size/${sys} ${title}`;
	url = url.replace(/ /g, '%20');
	log(url);
	let res = await dl(url + `%20Front%20Cover.jpg`, dir + '/box.jpg');
	if (res && prefs.ui.getBackCoverHQ) {
		await dl(url + `%20Back%20Cover.jpg`, dir + '/boxBack.jpg');
	}
	return res;
}

module.exports = async function(sys, game, dir, name) {
	let title = game.title.replace(/[\:]/g, '');
	if (sys != 'switch' && name == 'box') {
		if (sys != 'wii') {
			res = await dlFromAndy(title, dir, sys);
		} else if (game.id.length > 4) {
			res = await dlFromAndy(title, dir, 'gcn');
			if (!res) {
				res = await dlFromAndy(title, dir, 'wii');
			}
		} else {
			res = await dlFromAndy(title, dir, 'n64');
			if (!res) {
				res = await dlFromAndy(title, dir, 'snes');
			}
			if (!res) {
				res = await dlFromAndy(title, dir, 'nes');
			}
		}
		if (res) {
			return res;
		}
	}
};