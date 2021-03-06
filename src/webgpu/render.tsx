import TerrainGenerator from "./terrain_generator";
import { display_2d_vert, display_2d_frag, node_vert, node_frag, vsEdgeSource, fsEdgeSource } from "./wgsl";
// import * as d3 from 'd3';

const d3 = require("d3");
const Stardust = require("stardust-core");
const StardustWebGL = require("stardust-webgl");


class Renderer {
  public uniform2DBuffer: GPUBuffer | null = null;
  public terrainGenerator: TerrainGenerator | null = null;
  public device: GPUDevice;
  public bindGroup2D: GPUBindGroup | null = null;
  public nodeBindGroup: GPUBindGroup | null = null;
  public nodePositionBuffer: GPUBuffer | null = null;
  public edgeDataBuffer: GPUBuffer | null = null;
  public nodePipeline: GPURenderPipeline | null = null;
  public edgePipeline: GPURenderPipeline | null = null;
  public nodeLength: number = 1;
  public edgeVertexCount: number = 2;

  constructor(
    adapter: GPUAdapter,
    device: GPUDevice,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    colormap: ImageBitmap
  ) 
  {
    this.device = device;
    // Check that canvas is active
    if (canvasRef.current === null) return;
    const context = canvasRef.current.getContext("webgpu")!;
    const devicePixelRatio = window.devicePixelRatio || 1;
   
    const presentationSize = [
      canvasRef.current.clientWidth * devicePixelRatio,
      canvasRef.current.clientHeight * devicePixelRatio,
    ];
    const presentationFormat = context.getPreferredFormat(adapter);

    context.configure({
      device,
      format: presentationFormat,
      size: presentationSize,
    });

    this.nodePositionBuffer = device.createBuffer({
      size: 6 * 2 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.nodePositionBuffer.getMappedRange()).set([
      1, -1, -1, -1, -1, 1, 1, -1, -1, 1, 1, 1,
    ]);
    this.nodePositionBuffer.unmap();

    this.nodePipeline = device.createRenderPipeline({
      vertex: {
        module: device.createShaderModule({
          code: node_vert,
        }),
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 2 * 4,
            attributes: [
              {
                format: "float32x2" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ],
      },
      fragment: {
        module: device.createShaderModule({
          code: node_frag,
        }),
        entryPoint: "main",
        targets: [
          {
            format: presentationFormat,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        format: "depth24plus-stencil8",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });



    let layout = device.createPipelineLayout({bindGroupLayouts: []});
    let vsEdgeModule = device.createShaderModule({code: vsEdgeSource });
    let fsEdgeModule = device.createShaderModule({code: fsEdgeSource });
    
    this.edgeDataBuffer = device.createBuffer({
      size: 4*4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });

    let edgeData = [0, 0, 0.01, 0.01];
    new Float32Array(this.edgeDataBuffer.getMappedRange()).set(edgeData);

    //setting it to some trivial data so that it won't fail the pipeline before edge data is available

    let vertexState = {
      module: vsEdgeModule,
      entryPoint: "main",
      buffers:[
        {
          arrayStride: 2*4*1,
          attributes:[{
            format:"float32x2",
            offset: 0,
            shaderLocation: 0
          }
          ]
        }
      ]
    } 
    let fragmentState = {
      module: fsEdgeModule,
      entryPoint: "main",
      targets:[{
        format:presentationFormat
      }]
    }


    this.edgePipeline = device.createRenderPipeline({
      layout: layout,
      vertex: vertexState,
      fragment: fragmentState,
      depthStencil: {
        format:"depth24plus-stencil8",
        depthWriteEnabled: true,
        depthCompare: "less"
      },
      primitive: {
        topology: "line-list" //triangle-list is default   
      }
    });

    const pipeline = device.createRenderPipeline({
      vertex: {
        module: device.createShaderModule({
          code: display_2d_vert,
        }),
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 4 * 4,
            attributes: [
              {
                format: "float32x4" as GPUVertexFormat,
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ],
      },
      fragment: {
        module: device.createShaderModule({
          code: display_2d_frag,
        }),
        entryPoint: "main",
        targets: [
          {
            format: presentationFormat,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        format: "depth24plus-stencil8",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    // Vertices to render
    var dataBuf2D = device.createBuffer({
      size: 6 * 4 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(dataBuf2D.getMappedRange()).set([
      1,
      -1,
      0,
      1, // position
      -1,
      -1,
      0,
      1, // position
      -1,
      1,
      0,
      1, // position
      1,
      -1,
      0,
      1, // position
      -1,
      1,
      0,
      1, // position
      1,
      1,
      0,
      1, // position
    ]);
    dataBuf2D.unmap();

    // Set up uniform buffers for bind group
    this.uniform2DBuffer = device.createBuffer({
      size: 2 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      this.uniform2DBuffer,
      0,
      new Float32Array([0.8, 0.2]),
      0,
      2
    );
    const imageSizeBuffer = device.createBuffer({
      size: 2 * 4,
      usage: GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });
    new Uint32Array(imageSizeBuffer.getMappedRange()).set(presentationSize);
    imageSizeBuffer.unmap();
    const nodeDataBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Load colormap texture
    const colorTexture = device.createTexture({
      size: [colormap.width, colormap.height, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: colormap },
      { texture: colorTexture },
      [colormap.width, colormap.height, 1]
    );

    // Create depth texture
    var depthTexture = device.createTexture({
      size: {
        width: presentationSize[0],
        height: presentationSize[1],
        depthOrArrayLayers: 1,
      },
      format: "depth24plus-stencil8",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.terrainGenerator = new TerrainGenerator(
      device,
      presentationSize[0],
      presentationSize[1]
    );

    this.bindGroup2D = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: colorTexture.createView(),
        },
        {
          binding: 1,
          resource: {
            buffer: this.terrainGenerator.pixelValueBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.uniform2DBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: imageSizeBuffer,
          },
        },
      ],
    });
    // this.nodeBindGroup = device.createBindGroup({
    //   layout: pipeline.getBindGroupLayout(1),
    //   entries: [
    //     {
    //       binding: 0,
    //       resource: {
    //         buffer: nodeDataBuffer,
    //       }
    //     }
    //   ]
    // });
    var render = this;


    function frame() {
      // Sample is no longer the active page.
      if (!canvasRef.current) return;

      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();

      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view: textureView,
            loadValue: { r: 0.157, g: 0.173, b: 0.204, a: 1.0 },
            storeOp: "store" as GPUStoreOp,
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthLoadValue: 1.0,
          depthStoreOp: "store",
          stencilLoadValue: 0,
          stencilStoreOp: "store",
        },
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

      passEncoder.setPipeline(render.nodePipeline!);
      passEncoder.setVertexBuffer(0, render.nodePositionBuffer!);
      passEncoder.draw(render.nodeLength * 6, 1, 0, 0);

      passEncoder.setPipeline(render.edgePipeline!);
      passEncoder.setVertexBuffer(0, render.edgeDataBuffer);
      passEncoder.draw(render.edgeVertexCount);

      passEncoder.setPipeline(pipeline);
      passEncoder.setVertexBuffer(0, dataBuf2D);
      passEncoder.setBindGroup(0, render.bindGroup2D!);
      passEncoder.draw(6, 1, 0, 0);
      
      passEncoder.endPass();

      device.queue.submit([commandEncoder.finish()]);
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

  }


  setNodeData(nodeData: Array<number>, end: boolean) {
    // TODO: Implement the translation and global range options
    console.log(nodeData.length/2);
    // console.log(nodeData)
    if(end){
      console.log(end)
      this.terrainGenerator!.computeTerrain(nodeData);
    }

    var nodePositions: Array<number> = [];
    var radius: number = 0.01;
    for (var i = 0; i < nodeData.length; i += 2) {
      // var x = nodeData[i + 1] * 2 - 1;
      // var y = nodeData[i + 2] * 2 - 1;

      var x = nodeData[i];
      var y = nodeData[i+1];

      nodePositions.push(
        x + radius,
        y - radius,
        x - radius,
        y - radius,
        x - radius,
        y + radius,
        x + radius,
        y - radius,
        x - radius,
        y + radius,
        x + radius,
        y + radius
      );
    }
    this.nodePositionBuffer = this.device.createBuffer({
      size: nodePositions.length * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    
    new Float32Array(this.nodePositionBuffer.getMappedRange()).set(
      nodePositions
    );
    this.nodePositionBuffer.unmap();
    this.nodeLength = nodeData.length / 4;


    // this.nodeBindGroup = this.device.createBindGroup({
    //   layout: this.nodePipeline!.getBindGroupLayout(1),
    //   entries: [
    //     {
    //       binding: 0,
    //       resource: {
    //         buffer: this.terrainGenerator!.nodeDataBuffer,
    //       }
    //     }
    //   ]
    // });
  }


  setEdgeData(edgeData: Array<number>){
    // console.log(edgeData.length/4);

    this.edgeDataBuffer = this.device.createBuffer({
      size: edgeData.length*4,
      usage: GPUBufferUsage.COPY_SRC|GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(this.edgeDataBuffer.getMappedRange()).set(edgeData);
    this.edgeDataBuffer.unmap();
    this.edgeVertexCount = edgeData.length/2;
    
  }

  setWidthFactor(widthFactor: number) {
    this.terrainGenerator!.computeTerrain(undefined, widthFactor);
  }

  setPeakValue(value: number) {
    this.device.queue.writeBuffer(
      this.uniform2DBuffer!,
      0,
      new Float32Array([value]),
      0,
      1
    );
  }

  setValleyValue(value: number) {
    this.device.queue.writeBuffer(
      this.uniform2DBuffer!,
      4,
      new Float32Array([value]),
      0,
      1
    );
  }
}

export default Renderer;
