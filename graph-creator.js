//kick off function.
document.onload = (function(d3, saveAs, Blob, none){
  "use strict";


  // first step: define graphicreator object
  var GraphCreator = function(svg, nodes, edges){
    var thisGraph = this;  // this can be asigned to an object
        thisGraph.idct = 0;   //this graph's id

        thisGraph.nodes = nodes || [];
        thisGraph.edges = edges || [];
        thisGraph.selfEdges = edges||[];


        thisGraph.state = {
          selectedNode: null,
          selectedEdge: null,
          mouseDownNode: null,
          mouseDownLink: null,
          justDragged: false,
          justScaleTransGraph: false,
          lastKeyDown: -1,
          shiftNodeDrag: false,
          selectedText: null
        };





    // define arrow markers for graph links
    var defs = svg.append('svg:defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "33")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d','M0,-5L10,0L0,5')
      ;

    // define arrow markers for leading arrow
    defs.append('svg:marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5')
      ;


    thisGraph.svg = svg;
    thisGraph.svgG = svg.append("g")
          .classed(thisGraph.consts.graphClass, true);


    var svgG = thisGraph.svgG;     // define a svg group

    //M: drag a line from a node shows the marker at the edge of the line.
    thisGraph.dragLine = svgG.append('svg:path')
          .attr('class', 'link dragline hidden')
          .attr('d', 'M0,0L0,0')
          .style('marker-end', 'url(#mark-end-arrow)');

    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.circles = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
          .origin(function(d){ //M:start position before being dragged.
            return {x: d.x, y: d.y};
          })
          .on("drag", function(args){
            //thisGraph.state.justDragged = true;
            thisGraph.dragmove.call(thisGraph, args);
          })
          .on("dragend", function() { //M:when the drag gesture finishes.
            // todo check if edge-mode is selected
          });

    // listen for key events
    d3.select(window).on("keydown", function(){
      thisGraph.svgKeyDown.call(thisGraph);
      })
      .on("keyup", function(){
      thisGraph.svgKeyUp.call(thisGraph);
      });
    svg.on("mousedown", function(d){thisGraph.svgMouseDown.call(thisGraph, d);});
    svg.on("mouseup", function(d){thisGraph.svgMouseUp.call(thisGraph, d);});

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
          .on("zoom", function(){
            if (d3.event.sourceEvent.shiftKey){
              // TODO  the internal d3 state is still changing
              return false;
            } else{
              thisGraph.zoomed.call(thisGraph);
            }
            return true;
          })
          .on("zoomstart", function(){
            var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
            if (ael){
              ael.blur();
            }
            if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
          })

          .on("zoomend", function(){
            d3.select('body').style("cursor", "auto");
          });

     svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    //window.onresize = function(){thisGraph.updateWindow(svg);};

    // handle download data
    d3.select("#download-input").on("click", function(){
      var saveEdges = [];
      thisGraph.edges.forEach(function(val, i){
        saveEdges.push({title: val.title, selfReference:val.selfReference, text_propability:val.text_propability,text_comment:val.text_comment, source: val.source.id, target: val.target.id});
      });
      var blob = new Blob([window.JSON.stringify({"nodes": thisGraph.nodes, "edges": saveEdges})], {type: "text/plain;charset=utf-8"});
      saveAs(blob, "mydag.json");
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function(){
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function(){
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();

        filereader.onload = function(){
          var txtRes = filereader.result;
          // TODO better error handling
          try{
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
            var newEdges = jsonObj.edges;
            newEdges.forEach(function(e, i){
              newEdges[i] = {source: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0],
                          target: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0]};
            });
            // newEdges.forEach(function(e, i){
            //   newEdges[i] = {source: thisGraph.nodes.filter(function(n){return n.id == e.target;})[0],
            //                   target: thisGraph.nodes.filter(function(n){return n.id == e.source;})[0]}
            // });



            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          }catch(err){
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    // handle delete graph
    d3.select("#delete-graph").on("click", function(){
      thisGraph.deleteGraph(false);
    });
  };
  // finishing defining graphcreator object

  GraphCreator.prototype.setIdCt = function(idct){
    this.idct = idct;
  };


  GraphCreator.prototype.consts =  {

    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    selfReferenceJudge:false,
    bidirectionJudge: false,
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50
  };
  /* PROTOTYPE FUNCTIONS */

  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag){ //M: dragging a line from the node.
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else{ //M: dragging a node.
      d.x += d3.event.dx;  //M: returns the x delta that the mouse has moved .
      d.y +=  d3.event.dy;

      thisGraph.updateGraph();
    }
  };


  GraphCreator.prototype.deleteGraph = function(skipPrompt){
    var thisGraph = this,
        doDelete = true;
    if (!skipPrompt){
      doDelete = window.confirm("Press OK to delete this graph");
    }
    if(doDelete){
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };
  /* insert svg line breaks: taken from  */
  //M: insert text to nodes.
  GraphCreator.prototype.insertTitleLinebreaks = function (gEl, title) {
    var words = title.split(/\s+/g),
        nwords = words.length;

    var el = gEl.append("text")
          .attr("text-anchor","middle")
          .attr("dy", "-" + (nwords-1)*7.5);

    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }
  };


  GraphCreator.prototype.insertTitleInEdges = function (gEl, pathText) {
              // gEl.append("text")
              //  .style("font-size", "20px")
              //  .attr("dy", -18)
              //  .append("textPath")
              //  .attr("xlink:href", function(d,i){return "#normalLink_"+i;})
              //  .attr("startOffset", "50%")
              //  .text("dd")
              //  ;

               var normalLinkTextPropability =gEl.append("text")
                   .attr("dy", -18)
                   .style("font-size", "20px")
                   .append("textPath")
                   .attr("xlink:href", function(d,i){return "#normalLink_"+i;})
                   .attr("startOffset", "20%")
                   .text(pathText)
                   ;
                   alert("ttest");



               // gEl.append("text")
               // .style("font-size", "20px")
               // .attr("dy", +28)
               // //.attr("x", 50)
               // //.attr("transform", "translate(0,0) rotate(30)")
               // .append("textPath")
               // .style("text-anchor","middle")
               // .attr("xlink:href", function(d,i){return "#selfReferenceLink_"+i;})
               // .attr("startOffset", "50%")
               // .text(title)
               // ;

  }

  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function(node) {
    var thisGraph = this,
        toSplice = thisGraph.edges.filter(function(l) {
      return (l.source === node || l.target === node);
    });
    toSplice.map(function(l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };


  GraphCreator.prototype.replaceSelectEdge = function(d3Path, edgeData){
    var thisGraph = this;
    thisGraph.updateGraph();
    d3Path.classed(thisGraph.consts.selectedClass, true);

    //:not working
    if (thisGraph.state.selectedEdge){
      //alert("test4");
      GraphCreator.prototype.removeSelectFromEdge();

    }
    thisGraph.state.selectedEdge = edgeData;
  };


  GraphCreator.prototype.replaceSelectNode = function(d3Node, nodeData){
    var thisGraph = this;
    thisGraph.updateGraph();
    d3Node.classed(this.consts.selectedClass, true);


    if (thisGraph.state.selectedNode){
      thisGraph.removeSelectFromNode();

    }
    thisGraph.state.selectedNode = nodeData;
  };


  GraphCreator.prototype.removeSelectFromNode = function(){

    var thisGraph = this;
    //thisGraph.updateGraph();
    thisGraph.circles.filter(function(cd){
      return cd.id === thisGraph.state.selectedNode.id;

    })
    .classed(thisGraph.consts.selectedClass, false)
    ;

    thisGraph.state.selectedNode = null;
  };


  GraphCreator.prototype.removeSelectFromEdge = function(){

    var thisGraph = this;
    thisGraph.updateGraph();
    thisGraph.paths.filter(function(cd){
      return cd === thisGraph.state.selectedEdge;
    })
    .classed(thisGraph.consts.selectedClass, false);


    thisGraph.state.selectedEdge = null;

  };


  GraphCreator.prototype.pathMouseDown = function(d3path, d){
    var thisGraph = this,
            state = thisGraph.state;
            thisGraph.updateGraph();
        d3.event.stopPropagation();
        state.mouseDownLink = d;

        //M:working
        if (state.selectedNode){
          thisGraph.removeSelectFromNode();
        }

        //partly working
        var prevEdge = state.selectedEdge;
        if (!prevEdge || prevEdge !== d){
          //alert("test2");
          //thisGraph.removeSelectFromEdge();
          thisGraph.removeSelectFromEdge();
          thisGraph.replaceSelectEdge(d3path, d);
        }
        else{
          thisGraph.removeSelectFromEdge();
        }

      //M; remove table row text and textbox.
      svgT.selectAll("text").remove();

      d3.selectAll("foreignObject").remove();

      //M: define a table function for link
      popLinkText(d3path,d);

      function popLinkText(d3path, d){

        var thisGraph= this;

        var consts = GraphCreator.prototype.consts;

        var textLabel = svgT.selectAll("foreignObject")
              .data([d])
              .enter()//M: create a new object if there is a remaining data.
              .append("foreignObject")
              .attr("x", width/10*3/2)
              // .attr("y", function(d, i) {
              //   return (i + 4) + "em"
              // })
              .attr("y",height/10/1.4)
              .attr("width", "100%")
              .attr("height", "100%")
              .attr('id','idTextlabel')

              .append('xhtml:div')
              .attr("contentEditable", true)
              .text(d.title)
              .on("mousedown", function(d){
                d3.event.stopPropagation();
              })
              .on("keydown", function(d){
                d3.event.stopPropagation();
                if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
                  d.title = document.getElementById("idTextlabel").textContent;
                  this.blur();  //M: this is working here.
                }
              })
              .on("blur", function(d){
                d.title = document.getElementById("idTextlabel").textContent;
              })
              .style("font-size", mSize+"px")
              ;

        var textPropability = svgT
              .selectAll("textState")
                .data([d])
                .enter()//M: create a new object if there is a remaining data.
              .append("foreignObject")
              .attr("x", width/10*3/1.5)
              .attr("y",height/5.5)
              .attr('id','idTextPropability')
              .attr("width", "100%")
              .attr("height", "100%")
              .append('xhtml:div')
              .attr("contentEditable", true)
              .text(d.text_propability)
              .on("keydown", function(d){
                d3.event.stopPropagation();
                if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){

                  d.text_propability = document.getElementById("idTextPropability").textContent;

                  //d3path.select('text').remove();

                  //
                  // consts.currentObjectNormalLink= d.text_propability;
                  //
                  // alert(consts.currentObjectNormalLink);


                  //GraphCreator.prototype.insertTitleInEdges(consts.currentObjectNormalLink, d.text_propability);

                  this.blur();
                }
              })
              .on("blur", function(d){

                d.text_propability = document.getElementById("idTextPropability").textContent;

                d3path.select('text').remove();

                //GraphCreator.prototype.insertTitleInEdges(d3path, d.text_propability);

              })
              .style("font-size", mSize+"px")
              ;

        var textComment = svgT
                .selectAll("textState")
                  .data([d])
                  .enter()//M: create a new object if there is a remaining data.
                .append("foreignObject")
                .attr("x", width/10*3/1.5)
                // .attr("y", function(d, i) {
                //   return (i + 18) + "em"
                // })
                .attr("y",height/3.4)

                .attr('id','idTextComment')
                .attr("width", "100%")
                .attr("height", "100%")
                .append('xhtml:div')

                .attr("contentEditable", true)
                .text(d.text_comment)
                .on("keydown", function(d){
                  d3.event.stopPropagation();
                  if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
                    d.text_comment = document.getElementById("idTextComment").textContent;
                    this.blur();
                  }
                })
                .on("blur", function(d){
                  d.text_comment = document.getElementById("idTextComment").textContent;
                })
                .style("font-size", mSize+"px")
                ;

        // var textComment = svgT
        //         .selectAll("textState")
        //           .data([d])
        //           .enter()//M: create a new object if there is a remaining data.
        //         .append("foreignObject")
        //         .attr("x", width/10*3/1.7)
        //         .attr("y", function(d, i) {
        //           return (i + 24) + "em"
        //         })
        //         .attr('id','idTextComment')
        //         .attr("width", "100%")
        //         .attr("height", "100%")
        //         .append('xhtml:div')
        //         .attr("contentEditable", true)
        //         .text(d.text_comment)
        //         .on("keydown", function(d){
        //           d3.event.stopPropagation();
        //           if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
        //             d.text_comment = document.getElementById("idTextComment").textContent;
        //             this.blur();
        //           }
        //         })
        //         .on("blur", function(d){
        //           d.text_comment= document.getElementById("idTextComment").textContent;
        //         })
        //         .style("font-size", "40px");

        var rect1=svgT.append("rect")
                      .attr("width", width/10*3)
                      .attr("height", height-60)
                      .attr('x',30)
                      .attr('y',30)
                      .attr('class','rectangles');

        var rectState=svgT.append('svg:g');

                      rectState.append("rect")
                      .attr("width", width/10*3)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      // .on("mouseover",function(d) {
                      //                 d3.select(this).
                      //                 	style("fill", "yellow");
                      //                 })
                      .on("mouseout",function(d) {
                                      d3.select(this).
                                        style("fill", "none");
                                      })

                      //edit text here
                      .on("mousedown",function(d) {
                                    //rectStateText.remove('svg:text');
                                      //popText();
                                      })
                      .attr('y',30);



                      svgT.append("text")
                      .attr("x", width/35)
                      .attr("y", height/4)

                      .text("Probability")
                      .style("font-size", mSize+"px")
                      .style('fill','black');

                      svgT.append("text")
                      .attr("x", width/35)
                      .attr("y", height/2.75)
                      .text("Comment")
                      .style("font-size", mSize+"px")
                      .style('fill','black');

                      // svgT.append("text")
                      // .attr("x", width/10*3/5)
                      // .attr("y", (height-60)/2)
                      // .text("Comment")
                      // .style("font-size", "40px")
                      // .style('fill','black');

        var rectPropertyHead=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      .attr('y',30+(height-60)/8);

        var rectValueHead=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30+width/10*3/2)
                      .attr('y',30+(height-60)/8);

        var rectProperty1=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      .attr('y',30+2*(height-60)/8);

        var rectValue1=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30+width/10*3/2)
                      .on("mousedown",function(d) {
                                      })
                      .attr('y',30+2*(height-60)/8);

        var rectProperty2=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      .attr('y',30+3*(height-60)/8);

        var rectValue2=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30+width/10*3/2)
                      .on("mousedown",function(d) {
                                    })
                      .attr('y',30+3*(height-60)/8);

        var rectProperty3=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      .attr('y',30+4*(height-60)/8);

        var rectValue3=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30+width/10*3/2)
                      .on("mousedown",function(d) {
                                    })
                      .attr('y',30+4*(height-60)/8);

        var rectProperty4=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      .attr('y',30+5*(height-60)/8);

        var rectValue4=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30+width/10*3/2)
                      .attr('y',30+5*(height-60)/8);

        var rectProperty5=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      .attr('y',30+6*(height-60)/8);

        var rectValue5=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30+width/10*3/2)
                      .attr('y',30+6*(height-60)/8);

        var rectProperty6=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30)
                      .attr('y',30+7*(height-60)/8);

        var rectValue6=svgT.append("rect")
                      .attr("width", width/10*3/2)
                      .attr("height", (height-60)/8)
                      .attr('class','rectangles')
                      .attr('x',30+width/10*3/2)
                      .attr('y',30+7*(height-60)/8);
        }
  }


  GraphCreator.prototype.pathMouseUp = function(d3path, d){
  }

  // mousedown on node  //M define circleMouseDown
  GraphCreator.prototype.circleMouseDown = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state;
    d3.event.stopPropagation();
    //change color (mouse down event )
    state.mouseDownNode = d;



    if (state.selectedEdge){
      thisGraph.removeSelectFromEdge();
    }
    var prevNode = state.selectedNode;

    if (!prevNode || prevNode.id !== d.id){
      thisGraph.replaceSelectNode(d3node, d);
    } else{
      thisGraph.removeSelectFromNode();
    }

    if (d3.event.shiftKey){

      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      return;
    }
    else{  //M; only mousedown on nodes

    d3.selectAll("foreignObject").remove(); //M: remove the text box.

    //M;TODO remove previous table row.
    svgT.selectAll("text").remove();


    popNodeText(d3node, d);


      function popNodeText(d3node, d){
        var thisGraph= this;
        var  consts = GraphCreator.prototype.consts;
      //  var mSize = width/30;

            var textState = svgT.selectAll("foreignObject")
              .data([d])
              .enter()//M: create a new object if there is a remaining data.
              .append("foreignObject")
              .attr("x", width/8)
              // .attr("y", function(d, i) {
              //   return (i + 4) + "em"
              // })
              .attr("y",height/10/1.4)

              .attr("width", "100%")
              .attr("height", "100%")
              .attr('id','idTextState')

              .append('xhtml:div')
              .attr("contentEditable", true)
              .text(d.title)
              .on("mousedown", function(d){
                d3.event.stopPropagation();
              })
              .on("keydown", function(d){
                d3.event.stopPropagation();
                if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
                  d3node.selectAll("text").remove(); // M: delete previous text on nodes
                  d.title = document.getElementById("idTextState").textContent;
                  GraphCreator.prototype.insertTitleLinebreaks(d3node, d.title);
                  this.blur();  //M: this is working here.
                }
              })
              .on("blur", function(d){
                d3node.selectAll("text").remove(); // M: delete previous text on nodes
                d.title = document.getElementById("idTextState").textContent;
                GraphCreator.prototype.insertTitleLinebreaks(d3node, d.title);
              })

              .style("font-size", mSize+"px")
              ; //M: TODO need to be fixed.


              var textUtility = svgT
              .selectAll("textState")
                .data([d])
                .enter()//M: create a new object if there is a remaining data.
              .append("foreignObject")
              .attr("x", width/10*3/1.5)
              // .attr("y", function(d, i) {
              //   return (i + 12) + "em"
              // })
              .attr("y",height/5.5)
              .attr('id','idTextUtility')
              .attr("width", "100%")
              .attr("height", "100%")
              .append('xhtml:div')
              .attr("contentEditable", true)
              .text(d.text_utility)
              .on("keydown", function(d){
                d3.event.stopPropagation();
                if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
                  d.text_utility = document.getElementById("idTextUtility").textContent;
                  this.blur();
                }
              })
              .on("blur", function(d){
                d.text_utility = document.getElementById("idTextUtility").textContent;
              })
              .style("font-size", mSize+"px")
              ;


                var textCost = svgT
                .selectAll("textState")
                  .data([d])
                  .enter()//M: create a new object if there is a remaining data.
                .append("foreignObject")
                .attr("x", width/10*3/1.5)
                // .attr("y", function(d, i) {
                //   return (i + 18) + "em"
                // })
                .attr("y",height/3.4)
                .attr('id','idTextCost')
                .attr("width", "100%")
                .attr("height", "100%")
                .append('xhtml:div')

                .attr("contentEditable", true)
                .text(d.text_cost)
                .on("keydown", function(d){
                  d3.event.stopPropagation();
                  if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
                    d.text_cost = document.getElementById("idTextCost").textContent;
                    this.blur();
                  }
                })
                .on("blur", function(d){
                  d.text_cost = document.getElementById("idTextCost").textContent;
                })
                .style("font-size", mSize+"px")
                ;


                var textComment = svgT
                .selectAll("textState")
                  .data([d])
                  .enter()//M: create a new object if there is a remaining data.
                .append("foreignObject")
                .attr("x", width/10*3/1.5)
                .attr("y",height/2.43)
                .attr('id','idTextComment')
                .attr("width", "100%")
                .attr("height", "100%")
                .append('xhtml:div')
                .attr("contentEditable", true)
                .text(d.text_comment)
                .on("keydown", function(d){
                  d3.event.stopPropagation();
                  if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
                    d.text_comment = document.getElementById("idTextComment").textContent;
                    this.blur();
                  }
                })
                .on("blur", function(d){
                  d.text_comment= document.getElementById("idTextComment").textContent;
                })
                .style("font-size", mSize+"px")
                ;

                // var textExtra1 = svgT
                // .selectAll("textExtra1")
                //   .data([d])
                //   .enter()//M: create a new object if there is a remaining data.
                // .append("foreignObject")
                // .attr("x", width/10*3/1.7)
                // .attr("y",height/1.9)
                // .attr('id','idTextComment')
                // .attr("width", "100%")
                // .attr("height", "100%")
                // .append('xhtml:div')
                // .attr("contentEditable", true)
                // .text(d.text_comment)
                // .on("keydown", function(d){
                //   d3.event.stopPropagation();
                //   if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
                //     d.text_comment = document.getElementById("idTextComment").textContent;
                //     this.blur();
                //   }
                // })
                // .on("blur", function(d){
                //   d.text_comment= document.getElementById("idTextComment").textContent;
                // })
                // .style("font-size", "40px");


      }

      var rect1=svgT.append("rect")
                    .attr("width", width/10*3)
                    .attr("height", height-60)
                    .attr('x',30)
                    .attr('y',30)
                    .attr('class','rectangles');

      var rectState=svgT.append('svg:g');
                    rectState.append("rect")
                    .attr("width", width/10*3)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    // .on("mouseover",function(d) {
                    //                 d3.select(this).
                    //                 	style("fill", "yellow");
                    //                 })
                    .on("mouseout",function(d) {
                                    d3.select(this).
                                      style("fill", "none");
                                    })

                    //edit text here
                    .on("mousedown",function(d) {
                                  //rectStateText.remove('svg:text');
                                    //popText();
                                    })
                    .attr('y',30);


                    // var rectUtility =svgT.selectAll("rectState")
                    //                 .data([d])
                    //                 .enter()
                    //                 .append("text")
                    //             .attr("x", width/10*3/5)
                    //             .attr("y", (height-60)/4)
                    //             .attr('id','rectUtility')
                    //             .text("Utility")
                    //             .style("font-size", "40px")
                    //             .style('fill','black');

        var rectUtility = svgT.append("text")
                    .attr("x", width/10*3/5)
                    .attr("y", height/4)
                    .attr('id','rectUtility')
                    .text("Utility")
                    .style("font-size", mSize+"px")

                    .style('fill','black');

        var rectCost = svgT.append("text")
                    .attr("x", width/10*3/5)
                    .attr("y", height/2.75)
                    .text("Cost")
                    .style("font-size", mSize+"px")
                    .style('fill','black');

        var rectComment = svgT.append("text")
                    .attr("x", width/10*3/8)
                    .attr("y", height/2.1)
                    .text("Comment")
                    .style("font-size", mSize+"px")
                    .style('fill','black');

      var rectPropertyHead=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    .attr('y',30+(height-60)/8);

      var rectValueHead=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30+width/10*3/2)
                    .attr('y',30+(height-60)/8);

      var rectProperty1=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    .attr('y',30+2*(height-60)/8);

      var rectValue1=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30+width/10*3/2)
                    .on("mousedown",function(d) {
                                    })
                    .attr('y',30+2*(height-60)/8);

      var rectProperty2=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    .attr('y',30+3*(height-60)/8);

      var rectValue2=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30+width/10*3/2)
                    .on("mousedown",function(d) {
                                  })
                    .attr('y',30+3*(height-60)/8);

      var rectProperty3=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    .attr('y',30+4*(height-60)/8);

      var rectValue3=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30+width/10*3/2)
                    .on("mousedown",function(d) {
                                  })
                    .attr('y',30+4*(height-60)/8);

      var rectProperty4=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    .attr('y',30+5*(height-60)/8);

      var rectValue4=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30+width/10*3/2)
                    .attr('y',30+5*(height-60)/8);

      var rectProperty5=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    .attr('y',30+6*(height-60)/8);

      var rectValue5=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30+width/10*3/2)
                    .attr('y',30+6*(height-60)/8);

      var rectProperty6=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30)
                    .attr('y',30+7*(height-60)/8);

      var rectValue6=svgT.append("rect")
                    .attr("width", width/10*3/2)
                    .attr("height", (height-60)/8)
                    .attr('class','rectangles')
                    .attr('x',30+width/10*3/2)
                    .attr('y',30+7*(height-60)/8);
    }

    };

  /* place editable text on node in place of svg text */
  GraphCreator.prototype.changeTextOfNode = function(d3node, d){
    var thisGraph= this,
        consts = thisGraph.consts,
        htmlEl = d3node.node();
    d3node.selectAll("text").remove(); // move away previous text on nodes.
    var nodeBCR = htmlEl.getBoundingClientRect(),
        curScale = nodeBCR.width/consts.nodeRadius,
        placePad  =  5*curScale,
        useHW = curScale > 1 ? nodeBCR.width*0.71 : consts.nodeRadius*1.42;
    // replace with editableconent text
    var d3txt = thisGraph.svg.selectAll("foreignObject")
          .data([d])
          .enter()
          .append("foreignObject")
          .attr("x", nodeBCR.left + placePad )
          .attr("y", nodeBCR.top + placePad)
          .attr("height", 2*useHW)
          .attr("width", useHW)
          .append("xhtml:p")
          .attr("id", consts.activeEditId)
          .attr("contentEditable", "true")
          .text(d.title)
          .on("mousedown", function(d){
            d3.event.stopPropagation();
          })
          .on("keydown", function(d){
            d3.event.stopPropagation();
            if (d3.event.keyCode == consts.ENTER_KEY && !d3.event.shiftKey){
              this.blur();
            }
          })
          .on("blur", function(d){

            d.title = this.textContent;//M; saving function.
            thisGraph.insertTitleLinebreaks(d3node, d.title);
            d3.select(this.parentElement).remove();
          });
    return d3txt;
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function(d3node, d){
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    //d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);


    // we're in a different node: create new edge for mousedown edge and add to graph
    if (mouseDownNode !== d){

      var newEdge = { title: "label ",
                      selfReference:false,
                      text_propability:" none",
                      text_comment:" none",
                      source: mouseDownNode,
                      target: d};

      var filtRes = thisGraph.paths.filter(function(d){

//M: noew problem it has shiftkey
        //M: repeate a link on the existing link, but different directions.
        if (d.source === newEdge.target && d.target === newEdge.source ){
          //if (d.source === newEdge.target && d.target === newEdge.source && d3.event.shiftKey){
          //thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
          //thisGraph.edges.attr('class','curvedLink');

          GraphCreator.prototype.consts.bidirectionJudge = true;

          //alert("there are two links");
        }
        else if(d.source === newEdge.source && d.target === newEdge.target ){
          alert("You are repeating the same link");
        }


        return d.source === newEdge.source && d.target === newEdge.target;
      });

      if (!filtRes[0].length){
        thisGraph.edges.push(newEdge);
        thisGraph.updateGraph();
      }
    }

    //M: self reference.
    //M: TODO get rid of repeating self reference.
    else if(mouseDownNode === d && d3.event.shiftKey){
      var newSelfReferenceEdge = { title: "label ",
                                  selfReference:true,
                                  text_propability:" none",
                                  text_comment:" none",
                                  source: mouseDownNode,
                                  target: d};

        var filtRes = thisGraph.paths.filter(function(d){


          if (d.source === newSelfReferenceEdge.target
            && d.target === newSelfReferenceEdge.source
            &&d3.event.shiftKey){

          }
          return d.source === newSelfReferenceEdge.source &&
                 d.target === newSelfReferenceEdge.target;

        });


        if (!filtRes[0].length){
          thisGraph.edges.push(newSelfReferenceEdge);//M:push a new edge.
          GraphCreator.prototype.consts.selfReferenceJudge = true;
          thisGraph.updateGraph();
        }
    }

    else {
      // we're in the same node
      if (state.justDragged) {
        // dragged, not clicked
        state.justDragged = false;
      } else{
        // clicked, not dragged
        //M; mouseup with shiftKey
        if (d3.event.shiftKey){
          // shift-clicked node: edit text content
          var d3txt = thisGraph.changeTextOfNode(d3node, d);
          var txtNode = d3txt.node();
          thisGraph.selectElementContents(txtNode);  //M select all text as one element.
          txtNode.focus(); // pop up text on the nodes

        }else{
          //M; mousedown on edges && mouseup without shiftKey
          // if (state.selectedEdge){
          //   thisGraph.removeSelectFromNode();
          // }
          // // var prevNode = state.selectedNode;
          // //
          // // if (!prevNode || prevNode.id !== d.id){
          // //   thisGraph.replaceSelectNode(d3node, d);
          // // } else{
          // //   thisGraph.removeSelectFromNode();
          // // }
        }
      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function(){
    this.state.graphMouseDown = true;

  };

  // mouseup on main svg framework
  GraphCreator.prototype.svgMouseUp = function(){
    var thisGraph = this,
        state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey){
      // clicked not dragged from svg         //M: create new nodes with shift click.
      var xycoords = d3.mouse(thisGraph.svgG.node()),
          d = { id: thisGraph.idct++, title: 'New State '+thisGraph.idct,text_utility:"none ",text_cost:"none ",text_comment:"none ",
           x: xycoords[0], y: xycoords[1]};
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
      // make title of text immediently editable //M add new nodes and edit text immediently.
      var d3txt = thisGraph.changeTextOfNode(thisGraph.circles.filter(function(dval){
        return dval.id === d.id;
      }), d),
          txtNode = d3txt.node();
      thisGraph.selectElementContents(txtNode);
      txtNode.focus();
    } else if (state.shiftNodeDrag){ //M:shit drag lines from a node.
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true); //M: drag from the node and stop on the svg graph.
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function() {
    var thisGraph = this,
        state = thisGraph.state,
        consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if(state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
        selectedEdge = state.selectedEdge;

    switch(d3.event.keyCode) {
    case consts.BACKSPACE_KEY:
    case consts.DELETE_KEY:
      d3.event.preventDefault();

        if (selectedNode){  //M: delete node.
          thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
          thisGraph.spliceLinksForNode(selectedNode);
          state.selectedNode = null;
          thisGraph.updateGraph();
        } else if (selectedEdge){//M: delete link.
          thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
          state.selectedEdge = null;
          thisGraph.updateGraph();
        }
        break;



    }
  };


  GraphCreator.prototype.svgKeyUp = function() {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function(){

    var thisGraph = this,
        consts = thisGraph.consts,
        state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function(d){
      return String(d.source.id) + "+" + String(d.target.id);
    });

    var paths = thisGraph.paths;

    var newLinkGs = paths.enter().append("g");


    // update existing paths
    d3.selectAll(".normalLink")
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      //.attr("id", function(d,i) { return "normalLink_"+i; })
      .attr("d", function(d){
        //straight lines
        return "M" + (d.source.x) + "," + (d.source.y) +
               "L" + (d.target.x) + "," + (d.target.y);
      })
    ;

    d3.selectAll(".curvedLink")
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      //.attr("id", function(d,i) { return "curvedLink_"+i; })
      .attr("d", function(d){
        var offset = 30;

        var midpoint_x = (d.source.x + d.target.x) / 2;
        var midpoint_y = (d.source.y + d.target.y) / 2;

        var dx = (d.target.x - d.source.x);
        var dy = (d.target.y - d.source.y);

        var normalise = Math.sqrt((dx * dx) + (dy * dy));

        var offSetX = midpoint_x + offset*(dy/normalise);
        var offSetY = midpoint_y - offset*(dx/normalise);
        //curved lines
        return "M" + d.source.x + "," + d.source.y +
               "S" + offSetX+ "," + offSetY +
               " " + d.target.x + "," + d.target.y;
      })
    ;

    d3.selectAll(".selfReferenceLink")
      .classed(consts.selectedClass, function(d){
        return d === state.selectedEdge;
      })
      // .attr("id", function(d,i) { return "selfReferenceLink_"+i; })
      .attr("d", function(d) {
        var r = String(consts.nodeRadius);
        var circleX = d.target.x;
        var circleY = d.target.y;
        var startPointX = circleX-r;
        var startPointY = circleY-r/2;
        var controlPoint1X = circleX-2*r;
        var controlPoint1Y = circleY-r/2;
        var controlPoint2X = circleX-2*r;
        var controlPoint2Y = circleY+r/2;
        var endPointX = circleX-r;
        var endPointY = circleY+r/2;

        return "M" + startPointX + ' ' + startPointY +
               "C" + controlPoint1X + ' ' + controlPoint1Y +
               ',' + controlPoint2X + ' ' + controlPoint2Y +
               ',' + endPointX + ' ' + endPointY;
          }
        )
      ;


    if(GraphCreator.prototype.consts.selfReferenceJudge==true){

        GraphCreator.prototype.consts.selfReferenceJudge=false;

        var selfReferenceLink =
             //paths.enter().append('path').attr('class','selfReferenceLink')
             newLinkGs.append("path").attr('class','selfReferenceLink')
             .style('marker-end', 'url(#mark-end-arrow)')
             .classed("link", true)
             .attr("id", function(d,i) { return "selfReferenceLink_"+i; })
             .attr("d", function(d) {
                var r=String(consts.nodeRadius);
                var circleX = d.target.x;
                var circleY = d.target.y;
                var startPointX = circleX-r;
                var startPointY = circleY-r/2;
                var controlPoint1X = circleX-2*r;
                var controlPoint1Y = circleY-r/2;
                var controlPoint2X = circleX-2*r;
                var controlPoint2Y = circleY+r/2;
                var endPointX = circleX-r;
                var endPointY = circleY+r/2;

                return "M" + startPointX + ' ' + startPointY +
                       "C" + controlPoint1X + ' ' + controlPoint1Y +
                       ',' + controlPoint2X + ' ' + controlPoint2Y +
                       ',' + endPointX + ' ' + endPointY;
                  }
                )
             .on("mousedown", function(d){
                 thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);


                 }
                )
             .on("mouseup", function(d){
                 //thisGraph.pathMouseUp.call(thisGraph, newLinkGs, d);
                  state.mouseDownLink = null;
                 }
                )
             ;


             var selfReferenceLinkTextPropability =newLinkGs.append("g")
                 .append("text")
                 .attr("dy", -18)
                 .style("font-size", "20px")
                 .append("textPath")

                 .attr("xlink:href", function(d,i){return "#selfReferenceLink_"+i;})
                 .attr("startOffset", "20%")
                 //.text("this is self ")
                 ;



    }

    else if(GraphCreator.prototype.consts.bidirectionJudge==true){
      GraphCreator.prototype.consts.bidirectionJudge=false;

      var curvedLink = newLinkGs.append("path").attr('class','curvedLink')
           .style('marker-end','url(#end-arrow)')
           .classed("link", true)
           .attr("id", function(d,i) { return "curvedLink_"+i; })
           .attr("d", function(d){
             var offset = 30;

             var midpoint_x = (d.source.x + d.target.x) / 2;
             var midpoint_y = (d.source.y + d.target.y) / 2;

             var dx = (d.target.x - d.source.x);
             var dy = (d.target.y - d.source.y);

             var normalise = Math.sqrt((dx * dx) + (dy * dy));

             var offSetX = midpoint_x + offset*(dy/normalise);
             var offSetY = midpoint_y - offset*(dx/normalise);
             //curved lines
             return "M" + d.source.x + "," + d.source.y +
                    "S" + offSetX+ "," + offSetY +
                    " " + d.target.x + "," + d.target.y;
           })
           .on("mousedown", function(d){
            thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
            }
           )
           .on("mouseup", function(d){
            state.mouseDownLink = null;
            })
          ;

          var curvedLinkTextPropability =newLinkGs.append("g")
              .append("text")
              .attr("dy", -18)
              .style("font-size", "20px")
              .append("textPath")

              .attr("xlink:href", function(d,i){return "#curvedLink_"+i;})
              .attr("startOffset", "20%")
              //.text("curved link")
              ;
    }

    else {


        var normalLink = newLinkGs.append("path")
              .attr('class','normalLink')
             .style('marker-end','url(#end-arrow)')
             .classed("link", true)
             .attr("id", function(d,i) { return "normalLink_"+i; })
             .attr("d", function(d){
               return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
             })
             .on("mousedown", function(d){
               thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
              }
             )
             .on("mouseup", function(d){
               state.mouseDownLink = null;
              })
            ;


        var normalLinkTextPropability =newLinkGs.append("g")
            .append("text")
            .attr("dy", -18)
            .style("font-size", "20px")
            .append("textPath")
            .attr("xlink:href", function(d,i){return "#normalLink_"+i;})
            .attr("startOffset", "20%")
            //.text("njvdbj")
            ;


    }



    //M: might need to use this function in the future.
    normalLink.each(function(d){
      //thisGraph.insertTitleInEdges(newLinkGs, d.text_propability);
    });

    // remove old links
    paths.exit().remove();


    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function(d){ return d.id;});

    thisGraph.circles.attr("transform", function(d){return "translate(" + d.x + "," + d.y + ")";});

    // add new nodes
    var newGs = thisGraph.circles.enter().append("g");

    newGs.classed(consts.circleGClass, true)
         .attr("transform", function(d){
          return "translate(" + d.x + "," + d.y + ")"; //M: move the node to the mouse position.
           })
         .on("mouseover", function(d){
          if (state.shiftNodeDrag){
            d3.select(this).classed(consts.connectClass, true);
          }
        })
         .on("mouseout", function(d){
          d3.select(this).classed(consts.connectClass, false);
        })
         .on("mousedown", function(d){
          thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
        })
         .on("mouseup", function(d){
          thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
        })
         .call(thisGraph.drag);

    newGs.append("circle")
         .attr("r", String(consts.nodeRadius));

    //M: insert text in nodes.
    newGs.each(function(d){
      thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
    });

    // remove old nodes
    thisGraph.circles.exit().remove();
  };


  GraphCreator.prototype.zoomed = function(){
    this.state.justScaleTransGraph = true;
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
  };


  GraphCreator.prototype.updateWindow = function(svg){
    var docEl = document.documentElement,
        bodyEl = document.getElementsByTagName('body')[0];
     var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;

    svg.attr("width", x).attr("height", y);
  };

  /**** MAIN ****/
  window.onbeforeunload = function(){
    return "Make sure to save your graph locally before leaving :-)";
  };


  //M: define objects for users as a guide
  var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];

   var width = window.innerWidth|| docEl.clientWidth || bodyEl.clientWidth,

      height = window.innerHeight|| docEl.clientHeight|| bodyEl.clientHeight;

  var mSize = width/30;
   // var width =1270;
   // var height =750;


  var xLoc = width/2 - 25,
      yLoc = 100;
  // initial node data
  var nodes = [{node_id:1, id: 0, title: "New State 1", text_utility:"none", text_cost:"none",text_comment:"none", x: xLoc-300, y: yLoc+100},
                //{title: "New State", id: 2, x: xLoc-300, y: yLoc+500},
               {node_id:2, id: 1, title: "New State 2", text_utility:" none", text_cost:"none", text_comment:"none",x: xLoc-300, y: yLoc + 300}];

  var edges = [{ title: "label ", selfReference: false, text_propability:"none", text_comment:"none", source: nodes[1], target: nodes[0]}]; // links



  /** MAIN SVG **/


  // /** SVG2 for nodes **/
  var svg = d3.select("body").append("svg")
        .style("background",'powderblue')
        .attr("width", width/3*2)
        .attr("height", height);

  /** SVG2 for table **/
  var svgT = d3.select("body").append("svg")
        .style("background",'white')
        .attr('x',width/3*2)
        .attr("width", width/3*1)
        .attr("height", height);




  var graph = new GraphCreator(svg, nodes, edges);
      graph.setIdCt(2);
      graph.updateGraph();

})(window.d3, window.saveAs, window.Blob);
