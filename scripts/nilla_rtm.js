//BASIC REACTIVITY
/**
		* holds a reference to some variable
		* */
class Ref {
	__prop; //property which the ref refers to
	__watcher;
	constructor(property) {
		this.__prop = property;
		this.__watcher = new Set();
	}
	__update_watchers(prop = undefined) {
		for (const w of this.__watcher) {
			w.call(this, this, prop) //call watchers to signify the update on the property
		}
	}
	get value() { return this.__prop; }
	set value(data) {
		this.__update_watchers();
		this.__prop = data;
	}

	addWatcher(callback) {
		this.__watcher.add(callback);
	}
}

class ObjectRef extends Ref {
	__proxy;
	constructor(property) {
		super(property);
		this.__proxy = new Proxy(this, {
			has(target, key) {
				return key in target.__prop;
			},
			set(target, key, value) {
				target.__update_watchers(key);
				target.__prop[key] = value;
			},
			get(target, key) {
				return target.__prop[key];
			}
		})
	}
	get value() { return this.__proxy; }
}

//just a couple wrapper
function watch(prop, callback) { prop.addWatcher(callback); }
function lazy_watch(prop, callback, time = 20) {
	const fn = (ele, prop) => {
		callback.call(this, ele, prop)
	};

	let it = null;
	prop.addWatcher(function(ele, prop) {
		if (it) window.clearTimeout(it);
		it = setTimeout(fn, time, ele, prop);
	});
}

function ref(value) { return new Ref(value); }
function objectRef(value) { return new ObjectRef(value); }


//BASIC SCOPING
class Scope {
	__props;
	__callbacks;
	__used_vars;
	constructor(properties, nofallback = false, immutable = false) {
		this.__props = properties;
		this.__callbacks = new Map();
		this.__used_vars = new Set();
		this.props = new Proxy(properties, {
			has: (target, key) => {
				if (!(["__CODE__", "eval"].includes(key))) this.__used_vars.add(key);
				if (nofallback) return key in target
				return (key in target) || (key in window);
			},
			get: (target, key) => {
				if (typeof key === "string") {
					switch (key) {
						default:
							// console.log(key, target)
							if (key in target) return target[key];
							else if (key in window) return window[key];
							else throw new ReferenceError(`Undefined varibale: ${key}`)
					}
				}
			},
			set: (target, key, value) => {
				// console.log("value", key)
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

	update() {
		for (const [_, calss] of this.__callbacks) {
			for (const cal of calss) cal();
		}
	}

	delete(prop) {
		delete this.__props[prop];
	}

	force(prop, value) {
		this.__props[prop] = value;
	}

	addCallback(key, callback, exist = true) {
		if (!(key in this.__props || key === '__all') && exist) throw new Error("Invalid property to set callback");
		if (this.__callbacks.has(key)) {
			this.__callbacks.set(key, [...this.__callbacks.get(key), callback]);
		} else {
			this.__callbacks.set(key, [callback]);
		}
	};

	static singleUseObject(data) {
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
}

function safe_eval(code, context = {}, scope = {}) {
	const globalScope = scope instanceof Scope ? scope : new Scope(scope, true);
	globalScope.force("__CODE__", code);
	globalScope.__used_vars.clear();

	const result = (function() {
		with (globalScope.props) {
			"use strict"
			return eval(__CODE__);
		}
	}).call(context);

	globalScope.delete("__CODE__");

	return {
		result,
		context,
		scope: globalScope,
	};
}

const GlobalContext = {};
const GlobalScope = {};

class Template {
	constructor(data) {
		Template.findTemplates(data);
		// while (lastIndex < data.length && lastIndex >= 0) {
		// 	const { index, groups } = Template.findTemplate(data.slice(lastIndex))
		// 	console.log(index);
		// 	lastIndex += index
		// }
	}

	static findTemplates(data) {
		const tmplFn = new RegExp(/{(?<opt>[/#$])(?<type>\w+)?\s+(?<data>[^{}]+)\s*}/g);
		const result = tmplFn.exec(data)
		// if (result) {
		// 	const { groups, index, length } = result;
		// 	return { index, groups }
		// }
		// return { index: -1, groups: {} }
	}
}

class Component {
	/**@type {HTMLElement} __element**/
	__element;
	/**@type {string} __template**/
	__template;
	__context;//TODO: settup de context

	constructor(template, parent, context = {}) {
		this.__
	}

	static removeAttributes(element, attrs) {
		for (const attr of attrs) {
			element.removeAttribute(attr);
		}
	}

	static evaluateDraw(target, context, scope) {
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
		Component.removeAttributes(target, ["if", "elif", "else"]);//remove attributes from element
		return draw;
	};

	static cascadeTemplate(target, context, scope) {
		if (target.nodeType === 3 /*#text*/) {
			if (target.data.trim()) {
				const dataBk = target.data;
				const { value, vars } = Component.replaceTemplate(target.data, context, scope);
				// target.data = value;
				// if (vars.size && !target.context) {
				// 	target.context = context
				// 	for (const vr of vars) {
				// 		context.addCallback(vr, () => {
				// 			target.data = dataBk;
				// 			Component.cascadeTemplate(target, context, scope);
				// 		})
				// 	}
				// }
			}
		}//replace text nodes
		else if (target.nodeType === 8/*#comment*/) { }
		else {
			target.context = context
			//replace attributes
			// for (const attr of target.attributes) {
			// 	if (!attr.value) continue;
			// 	const attrValueBk = attr.value;
			// 	const { value, vars } = replaceAttrTemplate(attr.value, context, scope)
			// 	console.log(attr, value)
			// 	if (typeof value !== "string") {
			// 		target[attr.name] = value;
			// 		console.log("attr", attr, value)
			// 	} else {
			// 		target.setAttribute(attr.name, value);
			// 		if (vars.size) {
			// 			for (const vr of vars) {
			// 				context.addCallback(vr, () => {
			// 					const { value } = replaceAttrTemplate(attrValueBk, context, scope)
			// 					target.setAttribute(attr.name, value);
			// 				})
			// 			}
			// 		}
			// 	}
			//
			// }
			Component.evaluateElement(target, context, scope);
		}
	}

	static replaceAttrTemplate(template, context, scope) {
		let templateData = template;
		const templateMatcher = new RegExp(/{{(.*)}}/g);
		//matches all properties and removes its ${}
		const templated = (template.match(templateMatcher) || []).map(prop => prop.slice(2).slice(undefined, -2));

		const vars = new Set();
		if (templated.length > 1) {
			for (const tmpl of templated) {
				try {
					const res = safe_eval(tmpl, context, scope);
					templateData = templateData.replace(`{{${tmpl}}}`, res.result);
					vars.add(...res.scope.__used_vars);
				} catch (e) {
					console.error("TEMPLATE ERROR:", e);
				}
			}
		} else {
			try {
				const res = safe_eval(templated[0], context, scope);
				vars.add(...res.scope.__used_vars);
				return { value: res.result, vars };
			} catch (e) {
				console.error("TEMPLATE ERROR:", e);
			}

		}
		return { value: templateData, vars };
	}

	static replaceTemplate(template, context, scope) {
		let templateData = template;
		const templateMatcher = new RegExp(/{{([^{}]*)}}/g);
		//matches all properties and removes its ${}
		const templated = (template.match(templateMatcher) || []).map(prop => prop.slice(2).slice(undefined, -2));
		if (templated.length) {
			// templated.forEach((tmpl, index) => templated[index] = tmpl.trim())
		}

		console.log("templated:", templated)

		const vars = new Set();
		for (const tmpl of templated) {
			try {
				const res = safe_eval(tmpl, context, scope);
				templateData = templateData.replace(`{{${tmpl}}}`, res.result);
				vars.add(...res.scope.__used_vars);
			} catch (e) {
				console.error("TEMPLATE ERROR:", e);
			}
		}
		return { value: templateData, vars };
	}

	static evaluateElement(target, context, scope) {
		context.__HNDCOND = false;
		for (const child of Array.from(target.children)) {
			const draw = Component.evaluateDraw(child, context, scope);
			if (!draw) target.removeChild(child);
		}
		//remove children
		for (const child of target.childNodes)
			Component.cascadeTemplate(child, context, scope);
		return target;
	};

	static toElement(data, context, scope, base = document.createElement("div")) {
		context.__HNDCOND = false; //reset condition
		if (!data) return base; //early return
		base.innerHTML = data;
		return evaluateElement(base, context, scope);
	}

	static replaceElement(element, replacement) {
		// console.log("replacing", element, "with", replacement);
		const parent = element.parentElement
		if (parent) {
			parent.insertBefore(replacement, element);
			parent.removeChild(element);
		}

	}
}

//just a fancy console.log
// const csl = document.createElement("div");
// window.console = {
// 	log: (...msgs) => {
// 		const message = document.createElement("div");
// 		message.innerHTML = `<p>${msgs.map(msg => `<span>${msg}</span>`).join(' ')}</p>`
// 		csl.appendChild(message);
// 	}
// }
//
window.addEventListener("load", () => {
	// Component.cascadeTemplate(document.body, GlobalContext, GlobalScope);
})
