"use strict";
exports.__esModule = true;
var terrain_generator_1 = require("./terrain_generator");
var wgsl_1 = require("./wgsl");
var Renderer = /** @class */ (function () {
    function Renderer(adapter, device, canvasRef, colormap) {
        this.uniform2DBuffer = null;
        this.terrainGenerator = null;
        this.bindGroup2D = null;
        this.nodeBindGroup = null;
        this.nodePositionBuffer = null;
        this.nodePipeline = null;
        this.nodeLength = 1;
        this.device = device;
        // Check that canvas is active
        if (canvasRef.current === null)
            return;
        var context = canvasRef.current.getContext("webgpu");
        var devicePixelRatio = window.devicePixelRatio || 1;
        var presentationSize = [
            canvasRef.current.clientWidth * devicePixelRatio,
            canvasRef.current.clientHeight * devicePixelRatio,
        ];
        var presentationFormat = context.getPreferredFormat(adapter);
        context.configure({
            device: device,
            format: presentationFormat,
            size: presentationSize
        });
        this.nodePositionBuffer = device.createBuffer({
            size: 6 * 2 * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.nodePositionBuffer.getMappedRange()).set([
            1, -1, -1, -1, -1, 1, 1, -1, -1, 1, 1, 1,
        ]);
        this.nodePositionBuffer.unmap();
        this.nodePipeline = device.createRenderPipeline({
            vertex: {
                module: device.createShaderModule({
                    code: wgsl_1.node_vert
                }),
                entryPoint: "main",
                buffers: [
                    {
                        arrayStride: 2 * 4,
                        attributes: [
                            {
                                format: "float32x2",
                                offset: 0,
                                shaderLocation: 0
                            },
                        ]
                    },
                ]
            },
            fragment: {
                module: device.createShaderModule({
                    code: wgsl_1.node_frag
                }),
                entryPoint: "main",
                targets: [
                    {
                        format: presentationFormat
                    },
                ]
            },
            primitive: {
                topology: "triangle-list"
            },
            depthStencil: {
                format: "depth24plus-stencil8",
                depthWriteEnabled: true,
                depthCompare: "less"
            }
        });
        var pipeline = device.createRenderPipeline({
            vertex: {
                module: device.createShaderModule({
                    code: wgsl_1.display_2d_vert
                }),
                entryPoint: "main",
                buffers: [
                    {
                        arrayStride: 4 * 4,
                        attributes: [
                            {
                                format: "float32x4",
                                offset: 0,
                                shaderLocation: 0
                            },
                        ]
                    },
                ]
            },
            fragment: {
                module: device.createShaderModule({
                    code: wgsl_1.display_2d_frag
                }),
                entryPoint: "main",
                targets: [
                    {
                        format: presentationFormat
                    },
                ]
            },
            primitive: {
                topology: "triangle-list"
            },
            depthStencil: {
                format: "depth24plus-stencil8",
                depthWriteEnabled: true,
                depthCompare: "less"
            }
        });
        // Vertices to render
        var dataBuf2D = device.createBuffer({
            size: 6 * 4 * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(dataBuf2D.getMappedRange()).set([
            1,
            -1,
            0,
            1,
            -1,
            -1,
            0,
            1,
            -1,
            1,
            0,
            1,
            1,
            -1,
            0,
            1,
            -1,
            1,
            0,
            1,
            1,
            1,
            0,
            1,
        ]);
        dataBuf2D.unmap();
        // Set up uniform buffers for bind group
        this.uniform2DBuffer = device.createBuffer({
            size: 2 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.uniform2DBuffer, 0, new Float32Array([0.8, 0.2]), 0, 2);
        var imageSizeBuffer = device.createBuffer({
            size: 2 * 4,
            usage: GPUBufferUsage.UNIFORM,
            mappedAtCreation: true
        });
        new Uint32Array(imageSizeBuffer.getMappedRange()).set(presentationSize);
        imageSizeBuffer.unmap();
        var nodeDataBuffer = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        // Load colormap texture
        var colorTexture = device.createTexture({
            size: [colormap.width, colormap.height, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
        });
        device.queue.copyExternalImageToTexture({ source: colormap }, { texture: colorTexture }, [colormap.width, colormap.height, 1]);
        // Create depth texture
        var depthTexture = device.createTexture({
            size: {
                width: presentationSize[0],
                height: presentationSize[1],
                depthOrArrayLayers: 1
            },
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.terrainGenerator = new terrain_generator_1["default"](device, presentationSize[0], presentationSize[1]);
        this.bindGroup2D = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: colorTexture.createView()
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.terrainGenerator.pixelValueBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.uniform2DBuffer
                    }
                },
                {
                    binding: 3,
                    resource: {
                        buffer: imageSizeBuffer
                    }
                },
            ]
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
            if (!canvasRef.current)
                return;
            var commandEncoder = device.createCommandEncoder();
            var textureView = context.getCurrentTexture().createView();
            var renderPassDescriptor = {
                colorAttachments: [
                    {
                        view: textureView,
                        loadValue: { r: 0.157, g: 0.173, b: 0.204, a: 1.0 },
                        storeOp: "store"
                    },
                ],
                depthStencilAttachment: {
                    view: depthTexture.createView(),
                    depthLoadValue: 1.0,
                    depthStoreOp: "store",
                    stencilLoadValue: 0,
                    stencilStoreOp: "store"
                }
            };
            var passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(pipeline);
            passEncoder.setVertexBuffer(0, dataBuf2D);
            passEncoder.setBindGroup(0, render.bindGroup2D);
            passEncoder.draw(6, 1, 0, 0);
            passEncoder.setPipeline(render.nodePipeline);
            passEncoder.setVertexBuffer(0, render.nodePositionBuffer);
            passEncoder.draw(render.nodeLength * 6, 1, 0, 0);
            passEncoder.endPass();
            device.queue.submit([commandEncoder.finish()]);
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }
    Renderer.prototype.setNodeData = function (nodeData) {
        // TODO: Implement the translation and global range options
        this.terrainGenerator.computeTerrain(nodeData);
        var nodePositions = [];
        var radius = 0.01;
        for (var i = 0; i < nodeData.length; i += 4) {
            var x = nodeData[i + 1] * 2 - 1;
            var y = nodeData[i + 2] * 2 - 1;
            nodePositions.push(x + radius, y - radius, x - radius, y - radius, x - radius, y + radius, x + radius, y - radius, x - radius, y + radius, x + radius, y + radius);
        }
        this.nodePositionBuffer = this.device.createBuffer({
            size: nodePositions.length * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(this.nodePositionBuffer.getMappedRange()).set(nodePositions);
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
    };
    Renderer.prototype.setWidthFactor = function (widthFactor) {
        this.terrainGenerator.computeTerrain(undefined, widthFactor);
    };
    Renderer.prototype.setPeakValue = function (value) {
        this.device.queue.writeBuffer(this.uniform2DBuffer, 0, new Float32Array([value]), 0, 1);
    };
    Renderer.prototype.setValleyValue = function (value) {
        this.device.queue.writeBuffer(this.uniform2DBuffer, 4, new Float32Array([value]), 0, 1);
    };
    return Renderer;
}());
exports["default"] = Renderer;

//# sourceMappingURL=render.js.map
