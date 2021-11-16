
const loadData = async(path:string, callback)=>{
    var cb = function(err, data) {
        if(err) {
            console.error("error on loading file");
        } else {
             let count = 0;
             let canvas = canvasRef.current;
            callback(data);
        }
    };
    if(path.match(/\.csv$/i)) {
        d3.csv(path, cb);
    }
    if(path.match(/\.tsv$/i)) {
        d3.tsv(path, cb);
    }
    if(path.match(/\.json$/i)) {
        d3.json(path).then(
          (data)=>{
            callback(data);
          }
        ).catch((error)=>{console.error(error)});
    }
}

export default loadData;