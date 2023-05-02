//base overload  functions
Array.prototype.end = function() { return this[this.length - 1]; }

function singleUse(data) {
	const used = {};
	return new Proxy(data, {
		has(target, key) { return !used[key] && key in target },
		get(target, key) {
			if (used[key] || !(key in target)) throw new Error(`Trying to access invalid value: ${key}`);
			used[key] = true;
			return data[key];
		}
	});
}

class Scope {
	__properties;
	__callbacks;
	constructor(properties, nofallback = true, immutable = false) {
		this.__properties = properties;
		this.__callbacks = new Map();
		this.props = new Proxy(properties, {
			has: (target, key) => {
				if (nofallback) return true;
				return (key in target) || (key in window);
			},
			get: (target, key) => {
				if (typeof key === 'string') {
					switch (key) {
						default:
							if (key in target) return target[key];
							else if (key in window) return window[key];
							else throw new ReferenceError(`Undefined varibale: ${key}`)
					}
				}
			},
			set: (target, key, value) => {
				if (immutable) return false;
				target[key] = value;
				if (this.__callbacks.has('__all')) {
					for (const callback of this.__callbacks.get('__all')) callback.call(key, value)
				}
				if (this.__callbacks.has(key)) {
					for (const callback of this.__callbacks.get(key)) callback.call(key, value)
				}
				return true;
			}
		})
	}

	set(prop, value) {
		this.props[prop] = value;
	}

	force(prop, value) {
		this.__properties[prop] = value;
	}

	addCallback(key, callback, exist = true) {
		if (!(key in this.__properties || key === '__all') && exist) throw new Error("Invalid property to set callback");
		if (this.__callbacks.has(key)) {
			this.__callbacks.set(key, [...this.__callbacks.get(key), callback]);
		} else {
			this.__callbacks.set(key, [callback]);
		}
	};

}

const GlobalScope = new Scope(window, false);

function safe_eval(code, context = {}, scope = {}) {
	const globalScope = scope instanceof Scope ? scope : new Scope(scope, true);
	globalScope.force("__CODE__", code);
	return {
		result: (function() {
			with (globalScope.props) {
				return eval(__CODE__);
			}
		}).call(context),
		context,
		scope: globalScope,
	};
}


function requestFile(url, { method = "GET", params = undefined }, async = true) {
	const requester = new XMLHttpRequest();
	if (params != null) url += '?' + (new URLSearchParams(params)).toString();
	requester.overrideMimeType("text/plain")
	requester.open(method || "GET", url, async);
	if (async) {
		const output = new Promise((resolve, reject) => {
			requester.onreadystatechange = ({ target: req }) => {
				switch (req.readyState) {
					//ignore all of this cases for now
					// 0: /*UNSET*/ //TODO: handle UNSET state
					// 1: /*OPENED*/
					// 2: /*HEADERS_RECEIVED*/
					// 3: /*LOADING*/
					case 4: //DONE
						if (req.status >= 400 && req.status <= 599) {
							reject();
							return;
						} break;
					default: return;
				}
				resolve(req);
			}
		})
		requester.send(params);
		return output;
	}
	requester.send(params);

	return requester;
};
/**
	* Acess nested properties inside objects or array
	* example: const p = { person: { name:"Jhon", fingers:[0,10]} }
	* deepAccess(p,"person.name") // Jhon
	* deepAccess(p,"person.fingers.1")// 10
	* */
function deepAccess(obj, props) {
	let tmpObj = obj;
	if (!(typeof props === "string" || Array.isArray(props))) throw new Error(`Trying to access propery ${props} of Object`);
	const propsArray = typeof props === "string" ? props.split('.') : props;
	for (const prop of propsArray) {
		if (tmpObj == null) {
			throw new Error(`Trying to access property '${prop}' of ${tmpObj}`);
		} else {
			tmpObj = tmpObj[prop];
		}
	}

	return tmpObj;
}

Array.prototype.deepAccess = function(props) { return deepAccess(this, props); }
Object.prototype.deepAccess = function(props) { return deepAccess(this, props); }

function* range(start, end, step = 1) {
	if (start && end === undefined) { end = start; start = 0; }
	for (let i = start; i < end; i += step) yield i;
}

function* iter(iterable) {
	let index = 0;
	for (const item of iterable) {
		yield { index, item };
		index++;
	}
}

//
const __WATCH_TAGS = new Map();

function addComponentHandler(tag, callback) {
	__WATCH_TAGS.set(tag, callback);
}

function toScript(data) {
	const script = document.createElement("script")
	script.innerText = data;
	return script
}

function removeAttributes(element, attrs) {
	for (const attr of attrs) element.removeAttribute(attr);
}

function evaluateDraw(target, context, scope) {
	const { if: cif, elif, else: celse } = target.attributes;
	let draw = false;
	//evaluates the condition
	const handleCond = (condition) => {
		try {
			const res = safe_eval(condition, context, scope);
			context.__HNDCOND = res.result;
			return res.result
		} catch (e) {
			context.__HNDCOND = true;
			console.error(e);
		} return false;
	}
	//handle accross render conditions
	if (cif) draw = handleCond(cif.value);
	else if (elif) draw = !context.__HNDCOND && handleCond(elif.value);
	else if (celse) draw = !context.__HNDCOND;
	else { draw = true; context.__HNDCOND = false; }
	removeAttributes(target, ["if", "elif", "else"]);//remove attributes from element
	return draw;
};

function cascadeTemplate(target, context, scope) {
	if (target.nodeType === 3 /*#text*/) target.data = replaceTemplate(target.data, context, scope);//replace text nodes
	else if (target.nodeType === 8/*#comment*/) { }
	else {
		//replace attributes
		for (const attr of target.attributes) {
			target.setAttribute(attr.name, replaceTemplate(attr.value, context, scope))
		}
		evaluateElement(target, context, scope);
	}
}

function replaceTemplate(template, context, scope) {
	let templateData = template;
	const templateMatcher = new RegExp(/{{([^{}]*)}}/g);
	//matches all properties and removes its ${}
	const templated = (template.match(templateMatcher) || []).map(prop => prop.slice(2).slice(undefined, -2));
	console.log("props:", templated)

	for (const tmpl of templated) {
		try {
			const res = safe_eval(tmpl, context, scope);
			templateData = templateData.replace(`{{${tmpl}}}`, res.result);
		} catch (e) {
			console.error("TEMPLATE ERROR:", e);
			templateData = templateData.replace(`{{${tmpl}}}`, "{invalid}");
		}
	}
	return templateData;
}

function evaluateElement(target, context, scope) {
	context.__HNDCOND = false;
	for (const child of Array.from(target.children)) {
		const draw = evaluateDraw(child, context, scope);
		if (!draw) target.removeChild(child);
	}
	//remove children
	for (const child of target.childNodes)
		cascadeTemplate(child, context, scope);
	return target;
};

function toElement(data, context, scope, base = document.createElement("div")) {
	context.__HNDCOND = false; //reset condition
	if (!data) return base; //early return
	base.innerHTML = data;
	return evaluateElement(base, context, scope);
}

function replaceElement(element, replacement) {
	// console.log("replacing", element, "with", replacement);
	const parent = element.parentElement
	if (parent) {
		parent.insertBefore(replacement, element);
		parent.removeChild(element);
	}
}


















//component handle for loop
addComponentHandler("FOR", (target, parent) => {
	console.log(target, parent);
	const { innerHTML: data } = target;
	if (!data) {

	}
	// const { attributes, parentElement } = element;
	// const { each, key } = attributes;
	// if (!each || !each.value) throw new Error("Undefined loop region");
	//
	// const clone = (item, index) => {
	// 	for (const child of element.children) {
	// 		const cloned = child.cloneNode(true);
	// 		cloned.innerHTML = replaceTemplate(child.innerHTML, { item, index });
	// 		cloned.context = { ...element.context, item, index };
	// 		parentElement.insertBefore(cloned, element)
	// 	}
	// }
	//
	// try {
	// 	//evaluates region
	// 	const region = safe_eval(each.value, {}, { rn: range }).result;
	//
	// 	let iterator = [];
	// 	if (typeof region === "number") {
	// 		iterator = Array.from(range(0, region), (item) => ({ item }));
	// 	} else if (Array.isArray(region)) {
	// 		iterator = Array.from(region, (item) => ({ item }))
	// 	} else {
	// 		iterator = Array.from(region, (item) => ({ item }));
	// 	}
	//
	// 	if (key) {
	// 		//apply sorting based on key
	// 		iterator.sort((itA, itB) => {
	// 			if (key.value.startsWith('-')) return itA[key.value.slice(1)] < itB[key.value.slice(1)]
	// 			return itA[key.value] > itB[key.value]
	// 		})
	// 	}
	//
	// 	for (const { item, index } of iter(iterator)) clone(item.item, index);
	// } catch (e) {
	// 	console.error("ERROR trying to evaluate for loop", e);
	// }
	//
	// parentElement.removeChild(element);
})

// addComponentHandler("COMPONENT", (element) => {
// 	const { parentElement, attributes } = element;
// 	const { src, bind } = attributes;
// 	let variables = {};
// 	if (bind) variables = eval(`result = ${bind.value};result;`);
//
// 	if (element.innerHTML) element.innerHTML = "";
// 	const tmpDiv = document.createElement('div');
//
// 	requestFile(src.value, {}, true).then(({ status, response }) => {
// 		if (status === 404) throw new Error("Error loading extenal component");
// 		const { element, multiple } = toElement(response, variables);
// 		//flattend element inside DOM
// 		if (!multiple) {
// 			element.context = {};//add the component context to the element
// 			replaceElement(tmpDiv, element);
// 		}
// 		else {
// 			for (const child of element.children) {
// 				//replace script for running
// 				if (child.tagName === "SCRIPT") document.head.appendChild(toScript(child.innerHTML));
// 				else {
// 					const el = child.cloneNode(true);
// 					el.context = {};
// 					parentElement.insertBefore(el, tmpDiv);
// 				}
// 			}
// 			parentElement.removeChild(tmpDiv);
// 		}
// 	});
//
// 	replaceElement(element, tmpDiv);
// })

//handling buffer
const __HNDEL = new Map();
/**
	* Handles custom elements creation and tag substitution
	* @param {HTMLElement} element
	**/
function handleCustomElements(target, parent) {
	if (!parent) return;
	evaluateElement(target, {}, GlobalScope);
	if (__WATCH_TAGS.has(target.tagName) && !__HNDEL.has(target)) {
		__HNDEL.set(target, true);
		__WATCH_TAGS.get(target.tagName)(target, parent);
	} else {
		for (const child of target.children) {
			handleCustomElements(child, target);
		}
	}
}

const __SCRIPT_OBSERVER = new MutationObserver((ms) => {
	for (const { target, addedNodes } of ms) {
		if (target.tagName === "SCRIPT") {
			for (const node of addedNodes) {
				node.data = `with(GlobalScope.props){\n${node.data}\n};`;
			}
		}
	}
});

//__SCRIPT_OBSERVER.observe(document, { subtree: true, childList: true });


const __CUSTOM_OBSERVER = new MutationObserver((ms) => {
	for (const m of ms) {
		switch (m.type) {
			case "childList":
				for (const node of m.addedNodes) {
					if (node.nodeType === 3 /*#text*/) { }
					else if (node.nodeType === 8 /*#comment*/) { }
					else handleCustomElements(node, m.target);
				}
				break;
			default: break;
		}
	}
	__HNDEL.clear();
});

const __GCTTCOPY = { data: "" };

window.Rerender = function() {
	document.children[0].innerHTML = __GCTTCOPY.data;
	//evaluateElement(document.body, {}, GlobalScope);
	for (const node of document.children[0].childNodes) {
		if (node.nodeType === 3 /*#text*/) node.data = replaceTemplate(node.data, {}, GlobalScope);
		else if (node.nodeType === 8 /*#comment*/) { }
		else handleCustomElements(node, node.parentElement);
	}
}

window.addEventListener("load", () => {
	__GCTTCOPY.data = document.children[0].innerHTML;
	//evaluateElement(document.body, {}, GlobalScope);
	for (const node of document.children[0].childNodes) {
		if (node.nodeType === 3 /*#text*/) node.data = replaceTemplate(node.data, {}, GlobalScope);
		else if (node.nodeType === 8 /*#comment*/) { }
		else handleCustomElements(node, node.parentElement);
	}
	__CUSTOM_OBSERVER.observe(document.children[0], { subtree: true, childList: true });
})
