function toElement(data){
	const div = document.createElement("div");
	div.innerHTML = data;
	if(div.children.length == 1) return div.children[0];
	return div;
}

let DEFAULT_LINK_ELEMENT = document.createElement('a');

function linkTo(title, { url, callback }, root){
	const link = root instanceof HTMLElement ? root: DEFAULT_LINK_ELEMENT.cloneNode(true);
	link.innerHTML = title;
	link.href = url;
	if(callback){
		link.onclick = (e) => {
			e.preventDefault();
			callback.call(link,title,url)
		}
	}
	//TODO: sanitize link
	return link;
}

function insertChildren(parent,...children){
	for(const child of children){
		parent.appendChild(child)
	}
}

function* iterator(iterable, transform){
	for(const item of iterable){
		yield transform ? transform(item): item;
	}
}

const NavBarAreas = {
	TITLE:0,
	START:1,
	CENTER:2,
	END:3,
	FOOTER:4,
};

class ListView {
	options;
	values;

	constructor(options,...items){
		this.options = options;
		this.items = items;
	}

	get children(){
		return iterator(this.items, (item)=>{
			return item instanceof HTMLElement ? item: toElement(item)
		});	
	}
};

class Navbar {
	options;
	/**@types {HTMLElement} root**/
	root;areas;

	/**@types {HTMLElement[]} items**/
	items;

	constructor(root,options){
		this.root = root;
		this.options = Object.assign({
			areas:NavBarAreas,
			classList:["rst","flex-col",""],
			itemsClassList:["rst","w-full"],
			sizes:{
				[NavBarAreas.START]:"full",
				[NavBarAreas.CENTER]:"full",
				[NavBarAreas.END]:"full"
			}
		},options);
		this.areas = new Map();
		console.log(this.options)
		this._insertRegions();
	}

	_insertRegions(){
		for(const area of this.options.areas){
			const areaElement = toElement(`<ul class="${this.options.classList.join(' ')} ${this.options.sizes[area]}">`)
			this.areas.set(area,areaElement)
		}
		insertChildren(this.root,...this.areas.values());
	}

	insert({place,classList },...elements){
		for(const element of elements){
			const item = toElement(`<li class="${[...this.options.itemsClassList, ...(classList||[])].join(' ')}">`);
			insertChildren(item,element);

			const pl = place!==undefined ?place: NavBarAreas.CENTER;
			if(this.areas.has(pl)){
				const area = this.areas.get(pl);
				insertChildren(area,item);
			} else {
				console.warn(`NAVBAR ERROR: unhandled area ${pl}`);
			}
		}
		
	}

	remove(...elements){

	}
}

class Router{
	
	/**@type {HTMLElement} element**/
	navbar;

	/**@type {HTMLElement} element**/
	viewport;

	/**@type {Record<string,any>} routes**/
	routes;
	currentRoute;

	onUpdate;

	constructor(navbar,viewport,routes = {}, ...onUpdate){
		this.navbar = navbar;
		this.viewport = viewport;
		this.routes = routes;
		this.currentRoute = null;
		this.onUpdate = onUpdate;
		this.update();
	}

	render(){

	}

	update(){
		const { pathname } = window.location;
		this.currentRoute = pathname;

		for(const updateFn of this.onUpdate){
			updateFn.call(this)
		}
	}
}

function initRouter(root ,viewport, ...args){
	return new Router(root, viewport, ...args);
}
