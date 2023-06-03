fileUpload.addEventListener("change",upload);

const CHUNK_SIZE = 1024 * 1024 //10Mb
function clamp(x,a,b){
	return Math.max(a, Math.min(x,b));
}

/**
 	* @param {File} file
 	**/
function* ChunkReader(file){
	const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

	const readed = [];
	yield totalChunks;
	for(let i=0;i<totalChunks; i++){
		const readStart = i * CHUNK_SIZE;
		const readEnd = clamp((i+1) * CHUNK_SIZE,readStart,file.size)
		// const readSize = readEnd - readStart;
		const chunkData = file.slice(readStart,readEnd);
		const reader = new FileReader();
		reader.onload = (e)=>{
			readed.push([readStart,readEnd])
			console.log("reading",readed);
		}
		reader.readAsBinaryString(chunkData);

		yield;
	}
}


const uploader = new Worker("./scripts/upload.js");
uploader.addEventListener("message",()=>{
	console.log("upload ended")
})

function upload({target}){
	/** @type {FileList} files **/
	for(const file of target.files){
		const reader = ChunkReader(file);
		const totalChunks = reader.next().value;
		let readed = 0;
		for(const chunk of reader){
			console.log("reding chunk:",readed++)
		}
		delete reader;
	}
}

function uploadChunk({target}){
	uploader.postMessage([target.files])
}

