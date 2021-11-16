import React from 'react';
import {Form, Button} from "react-bootstrap";

const d3 = require("d3");
const Stardust = require("stardust-core");
const StardustWebGL = require("stardust-webgl");


type SidebarProps = {
  setNodeData: (nodeData : Array<number>) => void,
  setWidthFactor: (widthFactor : number) => void,
  setPeakValue: (value : number) => void,
  setValleyValue: (value : number) => void
}
type SidebarState = {
  nodeData: Array<number>
}

class Sidebar extends React.Component<SidebarProps, SidebarState> {
    constructor(props) {
      super(props);
      this.state = {nodeData: []};
      this.handleSubmit = this.handleSubmit.bind(this);
      this.readFiles = this.readFiles.bind(this);

    }

    loadData = (path:string, callback:(data:object)=>void)=>{
     var cb = function(err, data) {
      console.log("callback is called")
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


    componentDidUpdate(){
    
    let self = this;
    let end = false

    this.loadData("mygraph_1_regex.json", (data) => {
    var width = 700;
    var height = 500;
  
    const canvas2 = document.createElement("canvas");
    canvas2.width = width;
    canvas2.height = height;

    var platform = Stardust.platform("webgl-2d", canvas2, width, height);

    var snodes = Stardust.mark.create(Stardust.mark.circle(8), platform);
    var snodesBG = Stardust.mark.create(Stardust.mark.circle(8), platform);
    var snodesSelected = Stardust.mark.create(Stardust.mark.circle(8), platform);
    var sedges = Stardust.mark.create(Stardust.mark.line(), platform);

    let nodes = data.nodes;
    console.log(nodes)
    let edges = data.edges;

    let N = nodes.length;
    for (var i = 0; i < N; i++) {
      //tried to make it normalized but it seems all the calculation are done based on the viewport space so
      // Math.random()*2.0 -1.0 failed and eventually they are all going to space space and range because d3 works that way and takes all the input accordingly like forceX and forceY

         nodes[i].x = (Math.random() * width);
         nodes[i].y = (Math.random() * height); 
     }

     let colors = [
            [31, 119, 180],
            [255, 127, 14],
            [44, 160, 44],
            [214, 39, 40],
            [148, 103, 189],
            [140, 86, 75],
            [227, 119, 194],
            [127, 127, 127],
            [188, 189, 34],
            [23, 190, 207]
        ];
      
    colors = colors.map((x) => [x[0] / 255, x[1] / 255, x[2] / 255, 1]);

        snodes
            .attr("radius", 2)
            .attr("color", d => colors[parseInt(d.cluster)%10]);
        snodesBG
            .attr("radius", 3)
            .attr("color", [1, 1, 1, 0.5]);

        snodesSelected
            .attr("radius", 4)
            .attr("color", [228 / 255, 26 / 255, 28 / 255, 1]);

        sedges
            .attr("width", 0.5)
            .attr("color", d => {
                if (d.source.cluster == d.target.cluster){
                  let colorIndex = parseInt(d.source.cluster)%10;
                   return colors[colorIndex].slice(0, 3).concat([0.1]);
                }
                return [0.5, 0.5, 0.5, 0.1]
            });

          var force = d3.forceSimulation()
            .force("link", d3.forceLink().id(function (d) {return d.index }))
            .force("charge", d3.forceManyBody())
            .force("forceX", d3.forceX(width / 2))  //for attracting element to a given point
            .force("forceY", d3.forceY(height / 2))


        force.nodes(nodes);
        force.force("link").links(edges);
        force.force("forceX").strength(0.5); //strength of aatraction
        force.force("forceY").strength(0.5);
        force.force("link").distance(50);
        force.force("link").strength(0.05);
        force.force("charge").strength(-40);

        var positions = Stardust.array("Vector2")
            .value(d => [d.x, d.y])
            .data(nodes);
        var positionScale = Stardust.scale.custom("array(pos, value)")
            .attr("pos", "Vector2Array", positions);

        snodesSelected.attr("center", positionScale(d => d.index));
        snodes.attr("center", positionScale(d => d.index));
        snodesBG.attr("center", positionScale(d => d.index));
        sedges.attr("p1", positionScale(d => d.source.index));
        sedges.attr("p2", positionScale(d => d.target.index));

        snodesBG.data(nodes);
        snodes.data(nodes);
        sedges.data(edges);

        force.on("tick", () => {
            // if (isDragging && selectedNode && draggingLocation) {
            //     selectedNode.x = draggingLocation[0];
            //     selectedNode.y = draggingLocation[1];
            // }
            // console.log(nodes);
            positions.data(nodes);
            requestRender(false);
        })
        .on("end", ()=>{
          positions.data(nodes);
          requestRender(true);
        })
        ;

        requestRender();

       let selectedNode = null;
       var requested:number|null = null;

       function requestRender(last) {
          end = last;
           if (requested) return;
            requested = requestAnimationFrame(render);
        }

        function formatNodeData(snodes){
          let nodeData2 = [];
          let data = snodes._data;
          for(let i =0, length=data.length; i<length; i++){
            let x = (data[i].x/width)*2.0 -1.0;
            let y = 1.0 - (data[i].y/height)*2.0 ;
            nodeData2.push( x,y);
          }
          self.props.setNodeData(nodeData2, end);
          }

         function render() {
            requested = null;
            snodesSelected.data(selectedNode ? [selectedNode] : []);
            // Cleanup and re-render.
            platform.clear([1, 1, 1, 1]);
            formatNodeData(snodes);    
            platform.endPicking();

         }
        
    });
    }
  
    handleSubmit(event) {
      event.preventDefault();
      this.props.setNodeData(this.state.nodeData);
    }

    readFiles(event : React.ChangeEvent<HTMLInputElement>) {
        const files : FileList = event.target.files!;
        console.log(files);
        var nodeIDToValue = {};
        var nodeData : Array<number> = [];
        const edgeReader = new FileReader();
        edgeReader.onload = (event) => {
        //   var edgeData = (edgeReader.result as string).split("\n");
        //   for (var element of edgeData) {
        //     var parts = element.split("\t");
        //     if (nodeIDToValue[parts[0]] && nodeIDToValue[parts[1]]) {
        //       nodeElements.push({ data: { source: parts[0], target: parts[1], weight: parseFloat(parts[2]) } });
        //     }
        //   }
        //   await render(nodeData, index);
            console.log("not yet implemented edges");
        };
        const layoutReader = new FileReader();
        layoutReader.onload = (event) => {
          var layoutData = (layoutReader.result as string).split("\n");
          for (var element of layoutData) {
            var parts = element.split("\t");
            if (nodeIDToValue[parts[0]]) {
              // Pushes values to node data in order of struct for WebGPU:
              // nodeValue, nodeX, nodeY, nodeSize
              // console.log(parseFloat(nodeIDToValue[parts[0]]), parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]))
              nodeData.push(parseFloat(nodeIDToValue[parts[0]]), parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
            }
          }
          this.setState({nodeData: nodeData});
          edgeReader.readAsText(files[1]);
        };
        const nodeReader = new FileReader();
        nodeReader.onload = (event) => {
          var rawNodes = (nodeReader.result as string).split("\n");
          for (var element of rawNodes) {
            nodeIDToValue[element.split("\t")[0]] = element.split("\t")[1]
          }
          layoutReader.readAsText(files[1]);
        };
        nodeReader.readAsText(files[0]);
    }

    render() {
      return (
        <div className="sidebar"> 
        <Form style={{color: 'white'}} onSubmit={this.handleSubmit}>
          <Form.Group controlId="formFile" className="mt-3 mb-3">
            <Form.Label>Select Example Files</Form.Label>
            <Form.Control className="form-control" type="file" multiple onChange={this.readFiles}/>
            <Button className="mt-2" type="submit" variant="secondary" value="Submit">Submit</ Button>
          </Form.Group>
          <Form.Group> 
            <Form.Label> Width Factor </ Form.Label>
            <br/>
            <input type="range" defaultValue={1000} min={0} max={2000} onChange={(e) => this.props.setWidthFactor(parseFloat(e.target.value))} />
          </Form.Group>
          <Form.Group> 
            <Form.Label> Peak and Valley Values </ Form.Label>
            <br/>
            <input type="range" defaultValue={0.8} min={0.5} max={1} step={0.01} onChange={(e) => this.props.setPeakValue(parseFloat(e.target.value))} />
            <input type="range" defaultValue={0.2} min={0} max={0.5} step={0.01} onChange={(e) => this.props.setValleyValue(parseFloat(e.target.value))} />
          </Form.Group>
        </Form>
        </ div>
      );
    }
  }

export default Sidebar;