const rmDiacritics = require('diacritics').remove;

class Scraper {
	constructor() {
		// dl is a helper lib I made for downloading images
		const dl = require(__rootDir + '/scrape/dl.js');
		// scrapers that use dl
		let scrapers = {
			b: 'bmb',
			c: 'tcp',
			d: 'dec',
			f: 'fly',
			g: 'gfs',
			m: 'mdo',
			q: 'gqa',
			t: 'tdb'
		};
		for (let scraper in scrapers) {
			scraper = scrapers[scraper];
			this[scraper] = require(__rootDir + '/scrape/' + scraper + '.js');
		}
	}

	async getImg(sys, game, name, hq) {
		let res = await this.imgExists(sys, game, name);
		if (res || offline) return res;
		$('#loadDialog0').html(md(
			`scraping for the  \n${name}  \nof  \n${game.title}`
		));
		let imgDir = this.getImgDir(sys, game);
		let file, url;
		// check if game img is specified in the gamesDB
		if (game.img && game.img[name]) {
			log(name);
			url = game.img[name].split(' ');
			let ext, scraper;
			// url[0] is the url and url[1] is the file type
			if (url[1] && url[0].length != 1) {
				// catch and ignore old method of doing this from
				// a previous version of Bottlnose
				if (url[1][0] == '/' || url[1][0] == '\\') return;
				ext = url[1];
				url = url[0];
			} else if (url[0] == 'q') {
				url = this.gqa.unwrapUrl(sys, game, name);
			} else if (url[1]) {
				// url[0] is key for the scraper
				scraper = scrapers[url[0]];
				// the unique parts of the url for the site the img was scraped from
				let data = url.slice(1);
				// unwrap/unminify the url using the unique parts
				url = this[scraper].unwrapUrl(data);
			} else {
				// the url is just a regular old link
				url = url[0];
			}
			if (!ext) ext = url.substr(-3);
			file = `${imgDir}/${name}.${ext}`;
			if (scraper == 'gfs') {
				res = await this.gfs.dlImg(url, imgDir, name);
			} else {
				res = await dl(url, file);
			}
			if (res) return res;
		}

		if (game.id.includes('_TEMPLATE')) return;

		// get high quality box from Andy Decarli's site
		res = await this.dec.dlImg(sys, game, imgDir, name);
		if (res) return res;

		res = await this.mdo.dlImg(sys, game, imgDir, name);
		if (res) return res;

		if (hq) return;

		return await this.tdb.dlImg(sys, game, imgDir, name);
	}

	async loadImages(sys, sysStyle, games, themes, recheckImgs) {
		let imgDir;
		let _gamesLength = games.length;
		let isTemplate;

		// deprecated 3ds to n3ds
		if (sys == 'n3ds') {
			let depDir = `${prefs.nlaDir}/3ds`;
			if (await fs.exists(depDir)) {
				await fs.move(depDir, `${prefs.nlaDir}/n3ds`);
			}
		}
		// deprecated template dir
		let depTemplateDir = `${prefs.nlaDir}/${sys}/_TEMPLATE`;
		if (await fs.exists(depTemplateDir)) {
			if (sys == 'wii') {
				await fs.move(depTemplateDir + '/img',
					`${prefs.nlaDir}/${sys}/_TEMPLATE_gcn`);
			} else {
				await fs.move(depTemplateDir + '/img',
					`${prefs.nlaDir}/${sys}/_TEMPLATE_${sys}`);
			}
			await fs.remove(depTemplateDir);
		}
		let gamesTotal = games.length + 1;
		for (let i = 0; i < games.length + 1; i++) {
			$('#loadDialog2').text(`${i+1}/${gamesTotal} games`);
			let res;
			let game;
			if (!isTemplate && i == games.length) {
				game = themes[sysStyle].template;
				isTemplate = true;
				if (sys != sysStyle) i--;
			} else if (isTemplate) {
				game = themes[sys].template;
			} else {
				game = games[i];
			}
			if (game.title) {
				game.title = rmDiacritics(game.title);
			}
			imgDir = this.getImgDir(sys, game);

			if (sys != 'mame') {
				// move img dir from deprecated location
				let imgDirDep = imgDir + '/img';
				if (await fs.exists(imgDirDep)) {
					await fs.copy(imgDirDep, imgDir);
					await fs.remove(imgDirDep);
				}
			}

			if (recheckImgs || !(await fs.exists(imgDir))) {
				await fs.ensureDir(imgDir);

				if (!isTemplate ||
					(!(await this.imgExists(sys, game, 'coverFull')) &&
						!(await this.imgExists(sys, game, 'cover')) && sys != 'gba')
				) {
					await this.getImg(sys, game, 'box', 'HQ');
				}
				res = await this.getImg(sys, game, 'coverFull');
				if (!res) {
					await this.getImg(sys, game, 'coverSide');
					if (!(await this.imgExists(sys, game, 'boxBack'))) {
						await this.getImg(sys, game, 'coverBack');
					}
				}
				if (!res && !(await this.imgExists(sys, game, 'box'))) {
					res = await this.getImg(sys, game, 'cover');
					if (!res) res = await this.getImg(sys, game, 'box');
					if (!res) {
						games.splice(i, 1);
						i--;
						await fs.remove(imgDir);
						continue;
					}
				}

				if (sys == 'switch' || sys == 'n3ds' || sys == 'ds' || sys == 'gba') {
					await this.getImg(sys, game, 'cart');
				} else if (sys != 'mame') {
					await this.getImg(sys, game, 'disc');
				}

				if (sys == 'mame') {
					await this.getImg(sys, game, 'boxOpen');
				} else if (prefs.ui.getExtraImgs || isTemplate) {
					await this.getImg(sys, game, 'boxOpen');
					await this.getImg(sys, game, 'boxOpenMask');
					await this.getImg(sys, game, 'manual');
					await this.getImg(sys, game, 'memory');
					await this.getImg(sys, game, 'memoryBack');
				}
			}
		}
		if (_gamesLength != games.length) await outputGamesJSON();
		if (sys != 'mame' && sys != 'gba' && (!themes[sysStyle].default ||
				!(await this.getImg(sys, themes[sysStyle].default, 'box')))) {
			cui.err('ERROR: No default box image found for ' + themes[sysStyle].default.title + ' in the directory ' + this.getImgDir(sys, themes[sysStyle].default));
			return;
		}

		games = games.sort((a, b) => a.title.localeCompare(b.title));
	}

	getImgDir(sys, game) {
		let imgDir = `${prefs.nlaDir}/${sys}/${game.id}`;
		if (sys == 'mame') {
			imgDir = util.absPath('$0');
			imgDir = path.join(imgDir, `../artwork/${game.id}`);
		}
		return imgDir;
	}

	async imgExists(sys, game, name) {
		let imgDir = this.getImgDir(sys, game);
		let file = `${imgDir}/${name}.png`;
		if (!(await fs.exists(file))) {
			file = file.substr(0, file.length - 3) + 'jpg';
			if (!(await fs.exists(file))) {
				if (sys != 'mame' || name != 'boxOpen' || !(await fs.exists(`${imgDir}/default.lay`))) {
					return;
				} else {
					file = `${imgDir}/default.lay`;
				}
			}
		}
		return file;
	}
}

module.exports = new Scraper();