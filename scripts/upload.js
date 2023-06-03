//upload worker
const CHUNK_SIZE = 1024 * 1024 //10Mb
function clamp(x,a,b){
	return Math.max(a, Math.min(x,b));
}

/**
 	* @param {File} file
 	**/
function* ChunkReader(file){
	const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

	yield totalChunks;
	for(let i=0;i<totalChunks; i++){
		const readStart = i * CHUNK_SIZE;
		const readEnd = clamp((i+1) * CHUNK_SIZE,readStart,file.size)
		// const readSize = readEnd - readStart;
		const chunkData = file.slice(readStart,readEnd);
		const reader = new FileReaderSync();
		yield reader.readAsBinaryString(chunkData);
	}
}
/**
 	* @param {MessageEvent} e
 	* */
onmessage = function({ data }) {
	/** @type {FileList} files **/
	const files = data[0];
	for(const file of files){
		const reader = ChunkReader(file);
		const totalChunks = reader.next().value;
		let readed = 0;
	  for(const chunk of reader){
			readed++;
	  	console.log("readed",readed,"of",totalChunks," -> ", chunk.length, chunk[chunk.length/2])
		}
		delete reader;
	}

	this.postMessage("ended")
}
