/**
 * request a file
 **/
function requireFile(url, { method = "GET", params = undefined }, async = true) {
	const requester = new XMLHttpRequest();
	if (params != null) url += '?' + (new URLSearchParams(params)).toString();
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


class Component extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._script = function(){}
  }

	insertElements(...elements){
		const output = [];
		for(const el of elements){
			output.push(this.shadowRoot.appendChild(el));
		}
	}

  connectedCallback() {
    const { src } = this.attributes;

    if(src){
    	requireFile(src.value,{}).then(({status, responseText})=>{
    		if(status===200){
    			this.shadowRoot.innerHTML = responseText;
    		} else {
					this.shadowRoot.innerHTML = "failed to load component";
    		}
    	});
			this.shadowRoot.innerHTML = "Loading component...";
    } else {
			this.shadowRoot.innerHTML = "invalid component";
    }
  }
}

customElements.define('bind-comp', Component);
