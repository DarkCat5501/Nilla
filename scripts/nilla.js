
/**
 * sends a basic fetch request
 **/
export async function request(url, options = { params: undefined }, method = 'GET') {
	let i_options = { method };
	if ('GET' === method && options.params) { url += '?' + (new URLSearchParams(options.params)).toString(); }
	else if (options.params) { options.body = JSON.stringify(options.params); }
	return fetch(url, i_options)
};

/**
 * send a request and waits for the raw data
 * @param {string} url
 **/
export const requestRawFetch = async (url, params = {}, method = 'GET') => {
	let options = { method };
	if ('GET' === method) { url += '?' + (new URLSearchParams(params)).toString(); }
	else { options.body = JSON.stringify(params); }
	return fetch(url, options).then(response => response.text());
};

/**
 * request a file
 **/
export function requestFile(url, options = { method:"GET", params: undefined }, async = true) {
	const requester = new XMLHttpRequest();
	if (options.params != null) url += '?' + (new URLSearchParams(options.params)).toString();
	requester.open(options.method || "GET", url, async);
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
		requester.send(options.params);
		return output;
	}
	requester.send(options.params);

	return requester;
};

/**
 * sends a get request
 **/
export const get = async (url, params) => request(url, params, 'GET');

/**
 * sends a post request
 **/
export const post = async (url, params) => request(url, params, 'POST');

/**
 * Loads a file 
 * */
export const getFile = (url, params, async = false) => requestFile(url, { params }, async);


