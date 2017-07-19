function reheap(heap, compare, swap, cur) {
    compare = compare || function(a,b) { return a < b; };
    swap = swap || function(a,b) { };
    var child = cur;

    // recurse down the minheap, swapping entries as needed to
    // keep the heap property
    // 最小堆
    while (child > 0) {
        var parent = (child - 1) >> 1;
        if (compare(heap[child], heap[parent])) {
            var temp = heap[child];
            heap[child] = heap[parent];
            heap[parent] = temp;
            swap(parent, child);
            child = parent;
        } else break;
    }
}

// builds up the display positions of a balanced binary tree
function getTreePositions(levels, pos, spacing) {
    var ret = [],
        width = Math.pow(2, levels-1) * spacing.x;

    for (var level = 0; level < levels; level++) {
        var items = Math.pow(2, level),
            interval = width / items,
            y = pos.y + spacing.y * level,
            x = pos.x + (interval - width) / 2;

        for (var offset = 0; offset < items; offset++) {
            var i = items + offset - 1;
            ret[i] = {x: x + offset * interval, y: y};
            ret[i].parent = i ? Math.floor((i - 1)/2) : i;
            ret[i].id = i;
            ret[i].inHeap = true;
        }
    }

    return ret;
};

function createHeapVis(element) {
    var colours = d3.scale.linear().domain([0, 100]).range(["#1f77b4", "#ff7f0e"]);
    var current, count, pending, heap, items, node_max, tree_nodes, points = [], paused= false, levels=4, speed=800;

    function resetState() {
        var pointSize = 60;
        radius = function(p) { return Math.sqrt(p.value) + 12; }

        // if running on a phone, make things a little smaller
        if (document.documentElement.clientWidth < 1024) {
            radius = function(p) { return Math.sqrt(p.value)/2 + 7; };
            pointSize = 25;
        }

        var w = $("#title").width(),
            h = pointSize * (levels + 1) + 20;

        var svg = element.select(".heap-viz").append("svg");
        svg.attr("width", w)
           .attr("height", h);

        svg.append("rect")
            .attr("width", pointSize)
            .attr("height", pointSize)
            .attr("x", (w-pointSize)/2)
            .attr("y", h-pointSize)
            .attr("fill", "#F9F9F9")
            .attr("stroke", "#CCC")
            .attr("stroke-width", 1);

        current = -3;
        pending = [];
        node_max = (1 << levels) - 1;
        count = node_max;
        tree_nodes = 0;
        heap  = getTreePositions(levels, 
                                 {x:w/2, y: pointSize/2},
                                 {x:1.5 * pointSize, y:pointSize});
        items = [];

        // 上面的队列
        for (var i = 0; i < count; ++i) {
            var p = {x:w/2 - 60 * (i - current),y:h - pointSize/2};
            p.value = Math.ceil((99 * Math.random()));
            p.colour = colours(p.value);
            p.inHeap = false;
            items.push(p);
        }

        lines = svg.selectAll("line")
            .data(heap)
            .enter()
            .append("line");
        
        // 树上的枝
        lines.attr("x1", function(d) { return d.x; })
            .attr("y1", function(d) { return d.y; })
            .attr("x2", function(d) { return heap[d.parent].x;})
            .attr("y2", function(d) { return heap[d.parent].y;})
            .attr("stroke", "#CCC")
            .attr("stroke-width", 2)
            .attr("id", function(d) { return "line" + d.id;})
            .style("opacity", 0)

        // 结点
        points = svg.selectAll("points")
            .data(items)
            .enter()
            .append("g")
            .style("stroke", function(d) { return d.colour; })
            .style("fill", function(d) { return d.colour; })

        // 背景色
        background = points.append("circle")
              .attr("cx", function(d) { return d.x; })
              .attr("cy", function(d) { return d.y; })
              .attr("r", radius)
              .attr("fill", "white");

        // 圆环
        circle = points.append("circle")
              .attr("cx", function(d) { return d.x; })
              .attr("cy", function(d) { return d.y; })
              .attr("r", radius)
              .attr("fill-opacity", .2)
              .attr("stroke-width",  1);

        // 数字
        text = points.append("text")
            .attr("text-anchor", "middle")
            .attr("x", function(d) { return d.x; })
            .attr("y", function (d) { return d.y + 4; })
            .style("font-size", 12)
            .style("font-weight", 200)
            .text(function(d) { return d.value; });

        increment(); // 开始操作
    };

    function increment() {
        var duration = speed;
        if (paused) {
            duration = 50; // 等待时间
        } else if (pending.length) {
            // have items that need their positions swapped, do that
            duration /= 2;
            var toSwap = pending[0];
            pending = pending.splice(1, pending.length);

            var temp = toSwap[0].x;
            toSwap[0].x = toSwap[1].x;
            toSwap[1].x = temp;

            temp = toSwap[0].y;
            toSwap[0].y = toSwap[1].y;
            toSwap[1].y = temp;

            temp = toSwap[0].inHeap;
            toSwap[0].inHeap = toSwap[1].inHeap;
            toSwap[1].inHeap = temp;
        } else {
            // just move all items 50px to the right, and 
            // call the 'reheap' item on the heap of current item
            // 所有队列中的数据向右移动
            for (var i = 0; i < items.length; ++i) {
                if (!items[i].inHeap) {
                    items[i].x += 60;
                }
            }
            current += 1; // 添加一个数据
            if ((current >= 0) && (current < count) && tree_nodes < node_max) {
                pending.push([items[current], heap[tree_nodes]]);
                heap[tree_nodes] = items[current];
                heap[tree_nodes].show = true;

                function swap(a,b) {
                    pending.push([heap[a], heap[b]]);
                }

                function compare(a, b) {
                    return a.value < b.value;
                }

                reheap(heap, compare, swap, tree_nodes);
                tree_nodes++;
            }
        }

        var transition = d3.transition()
                            .duration(duration);

        // move things. todo: figure out a way to transition just the group
        // and not have to transition each element
        // 添加过渡效果，结点移动动画
        circle.transition()
            .duration(duration)
            .attr("cx", function(d,i) { return d.x; })
            .attr("cy", function(d,i) { return d.y; })
            .ease("ease");

        background.transition()
            .duration(duration)
            .attr("cx", function(d,i) { return d.x; })
            .attr("cy", function(d,i) { return d.y; })
            .ease("ease");

        text.transition()
            .duration(duration)
            .attr("x", function(d,i) { return d.x; })
            .attr("y", function (d) { return d.y + 4; })
            .ease("ease");

        lines.transition()
            .duration(duration)
            .style("opacity", function(d) { return d.id < tree_nodes ? 1 : 0;})
            .ease("ease");

        if (current < count + 10) {
            transition.each("end", increment); // 添加下个数据
        }

        if (current >= count) {
            element.selectAll("rect").attr("style", "display:none");
        }
    };

    resetState(); // 重置状态

    function pause() {
        paused = true;
        element.select(".pause-label").text(" 继续");
        element.select(".glyphicon-pause").attr("style", "display:none");
        element.select(".glyphicon-play").attr("style", "display:inline");
    }

    function resume() {
        paused = false;
        element.select(".pause-label").text(" 暂停");
        element.select(".glyphicon-pause").attr("style", "display:inline");
        element.select(".glyphicon-play").attr("style", "display:none");
    }

    function togglePause() {
        if (paused) {
            resume();
        } else {
            pause();
        }
    }

    function restart() {
        element.selectAll("svg").data([]).exit().remove();
        resetState();
        resume();
    }

    element.select(".restart-button").on("click", restart);
    element.select(".pause-button").on("click",  togglePause);

    element.select(".speed1").on("click", function() { speed = 1600; });
    element.select(".speed2").on("click", function() { speed = 800; });
    element.select(".speed3").on("click", function() { speed = 400; });
    element.select(".speed4").on("click", function() { speed = 100; });
}
