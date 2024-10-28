import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

/**
 * Controller class for the practice page.
 */
class Roadmap {
  roadmapTypeButtons = null;

  roadmapIntro = null;
  roadmapDetails = null;
  roadmapDetailsEco = null;
  roadmapDetailsPgn = null;
  roadmapDetailsAccuracy = null;

  roadmapContainerWhite = null;
  roadmapContainerBlack = null;

  roadmapForm = {
    form: null,
    id: null,
    color: null,
    pgn: null,
    fen: null,
    line: null,
  };

  roadmap = [];

  constructor() {
    // get the elements
    this.roadmapTypeButtons = document.getElementById("roadmapTypeButtons");

    this.roadmapIntro = document.getElementById("roadmapIntro");
    this.roadmapDetails = document.getElementById("roadmapDetails");
    this.roadmapDetailsEco = document.getElementById("roadmapDetailsEco");
    this.roadmapDetailsPgn = document.getElementById("roadmapDetailsPgn");
    this.roadmapDetailsAccuracy = document.getElementById(
      "roadmapDetailsAccuracy"
    );

    this.openInRepertoireLink = document.getElementById("openInRepertoireLink");
    this.openInPracticeLink = document.getElementById("openInPracticeLink");

    this.roadmapContainerWhite = document.getElementById(
      "roadmapContainerWhite"
    );
    this.roadmapContainerBlack = document.getElementById(
      "roadmapContainerBlack"
    );

    this.roadmapForm.form = document.getElementById("roadmapForm");
    this.roadmapForm.id = document.getElementById("roadmapIdInput");
    this.roadmapForm.color = document.getElementById("roadmapColorInput");
    this.roadmapForm.pgn = document.getElementById("roadmapPgnInput");
    this.roadmapForm.fen = document.getElementById("roadmapFenInput");
    this.roadmapForm.line = document.getElementById("roadmapLineInput");

    // add event listeners
    this.roadmapTypeButtons.children[0].children[0].addEventListener(
      "click",
      (event) => {
        this.showRoadmapType("white");
      }
    );
    this.roadmapTypeButtons.children[1].children[0].addEventListener(
      "click",
      (event) => {
        this.showRoadmapType("black");
      }
    );

    this.openInRepertoireLink.addEventListener("click", () => {
      document.forms["roadmapForm"].action = "./repertoire";
      document.forms["roadmapForm"].submit();
    });
    this.openInPracticeLink.addEventListener("click", () => {
      document.forms["roadmapForm"].action = "./practice";
      document.forms["roadmapForm"].submit();
    });

    // get the roadmap
    this.getRoadmap();
  }

  // toggle white/black
  showRoadmapType(type) {
    if (type == "white") {
      this.roadmapContainerWhite.classList.remove("hidden");
      this.roadmapContainerBlack.classList.add("hidden");
    } else {
      this.roadmapContainerWhite.classList.add("hidden");
      this.roadmapContainerBlack.classList.remove("hidden");
    }
    // show the roadmap intro
    this.showRoadmapIntro();
  }

  // show the roadmap intro text
  showRoadmapIntro() {
    this.roadmapIntro.classList.remove("hidden");
    this.roadmapDetails.classList.add("hidden");
  }

  // show the roadmap details
  showRoadmapDetails(line) {
    // update the info
    this.roadmapDetailsEco.innerHTML = line.eco.name;
    this.roadmapDetailsPgn.innerHTML = line.pgn;
    this.roadmapDetailsAccuracy.innerHTML =
      Math.round((1 - line.fail) * 100) + "%";

    // updat the info in the form
    this.roadmapForm.id.value = line.id;
    this.roadmapForm.color.value = line.color;
    this.roadmapForm.pgn.value = line.pgn;
    this.roadmapForm.fen.value = "";

    // remove the existing line[] fields
    var inps = Array.from(this.roadmapForm.form.getElementsByTagName("input"));
    for (var i = 0; i < inps.length; i++) {
      if (inps[i].name == "line[]") {
        this.roadmapForm.form.removeChild(inps[i]);
      }
    }

    // add the new line[] fields
    for (var i = 0; i < line.line.length; i++) {
      var inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = "line[]";
      inp.value = line.line[i];

      this.roadmapForm.form.appendChild(inp);
    }

    // show the details
    this.roadmapIntro.classList.add("hidden");
    this.roadmapDetails.classList.remove("hidden");
  }

  // get the roadmap
  getRoadmap() {
    // show the page loader
    Utils.showLoading();

    var url = "/api/roadmap";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // load the roadmap
        this.onGetRoadmap(response);
      })
      .catch((error) => {
        console.error("Error:", error);
        // show the error icon
        Utils.showError();
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  onGetRoadmap(roadmap) {
    // store the settings
    this.roadmap = roadmap;

    // clear the roadmaps
    this.roadmapContainerWhite.innerHTML = "";
    this.roadmapContainerBlack.innerHTML = "";

    // load the roadmaps
    this.roadmapContainerWhite.appendChild(this.loadRoadmap(roadmap["white"]));
    this.roadmapContainerBlack.appendChild(this.loadRoadmap(roadmap["black"]));
  }

  loadRoadmap(roadmap, depth = 0, hidden = false) {
    var colors = [
      "text-white bg-red-500",
      "text-white bg-orange-400",
      "text-white bg-yellow-500",
      "text-white bg-secondary-500",
    ];

    //
    var div = document.createElement("div");
    div.className = "flex items-start justify-center";
    // do we need to hide it?
    if (depth >= 3 && hidden == false && roadmap.length > 2) {
      div.className += " hidden";

      hidden = true;
    }

    //
    for (var i = 0; i < roadmap.length; i++) {
      //
      var sp = document.createElement("div");
      sp.className =
        "flex flex-col items-stretch" +
        (depth > 0 && roadmap.length > 1 && i > 0 && i < roadmap.length - 1
          ? " border-t border-gray-700 dark:border-gray-100"
          : "");

      //
      var moveCon = document.createElement("div");
      moveCon.className = "flex flex-col justify-stretch items-start";

      //
      if (depth > 0 && roadmap.length > 1 && i == 0) {
        //
        var topLine = document.createElement("div");
        topLine.className =
          "self-end rounded-tl border-l border-t border-gray-700 dark:border-gray-100";
        topLine.style = "width: 50%; height: 16px;";
        //
        moveCon.appendChild(topLine);
      } else if (depth > 0 && roadmap.length > 1 && i == roadmap.length - 1) {
        //
        var topLine = document.createElement("div");
        topLine.className =
          "rounded-tr border-r border-t border-gray-700 dark:border-gray-100";
        topLine.style = "width: 50%; height: 16px;";
        //
        moveCon.appendChild(topLine);
      } else if (depth > 0 && roadmap.length > 1) {
        //
        var topLine = document.createElement("div");
        topLine.className = "border-r border-gray-700 dark:border-gray-100";
        topLine.style = "width: 50%; height: 15px;";
        //
        moveCon.appendChild(topLine);
      }

      // get the accuracy index for the colors
      var accuracyIdx = Math.max(0, Math.ceil((1 - roadmap[i].fail) * 4) - 1);

      //
      var hdr = document.createElement("span");
      hdr.className =
        "self-center cursor-pointer text-sm py-1 px-2 mx-1 whitespace-nowrap rounded border border-gray-700 dark:border-gray-100 " +
        colors[accuracyIdx];
      hdr.title =
        (roadmap[i].eco && roadmap[i].eco.name ? roadmap[i].eco.name : "") +
        " (" +
        Math.round((1 - roadmap[i].fail) * 100) +
        "%)";
      //
      //hdr.innerHTML = roadmap[i].eco.name;
      hdr.innerHTML =
        roadmap[i].move && roadmap[i].move != ""
          ? roadmap[i].move
          : roadmap[i].line[roadmap[i].line.length - 1];
      //
      moveCon.appendChild(hdr);

      hdr.addEventListener(
        "click",
        (function (_this, line) {
          return function () {
            _this.showRoadmapDetails(line);
          };
        })(this, roadmap[i])
      );

      // if this move has lines, add a vertical line in the middle (connector)
      if (roadmap[i].lines.length > 0) {
        //
        var line = document.createElement("div");
        line.style =
          "width: 50%; height: " +
          (roadmap[i].lines.length > 1 ? "8" : "15") +
          "px;";
        line.className = "border-r border-gray-700 dark:border-gray-100";

        moveCon.appendChild(line);

        //
        if (roadmap[i].lines.length > 1) {
          //
          var invisible =
            depth >= 2 && hidden == false && roadmap[i].lines.length > 2;
          var icon = invisible
            ? "icon-[mdi--show-outline]"
            : "icon-[mdi--hide-outline]";
          //
          var toggle = document.createElement("span");
          toggle.className =
            "text-gray-600 dark:text-gray-200 cursor-pointer text-base self-center w-5 h-5 " +
            icon;
          toggle.style = "margin-top: -4px; margin-bottom: -4px;";
          toggle.title = invisible ? "Show this line" : "Hide this line";
          toggle.setAttribute("data-visible", invisible ? "no" : "yes");

          toggle.addEventListener(
            "click",
            ((toggle) => {
              return function (event) {
                // toggle the container for the child moves
                if (toggle.getAttribute("data-visible") == "yes") {
                  toggle.setAttribute("data-visible", "no");
                  toggle.classList.remove("icon-[mdi--hide-outline]");
                  toggle.classList.add("icon-[mdi--show-outline]");
                  toggle.title = "Show this line";
                  toggle.nextElementSibling.classList.add("hidden");
                  toggle.parentNode.nextElementSibling.classList.add("hidden");
                } else {
                  toggle.setAttribute("data-visible", "yes");
                  toggle.classList.remove("icon-[mdi--show-outline]");
                  toggle.classList.add("icon-[mdi--hide-outline]");
                  toggle.title = "Hide this line";
                  toggle.nextElementSibling.classList.remove("hidden");
                  toggle.parentNode.nextElementSibling.classList.remove(
                    "hidden"
                  );
                }
              };
            })(toggle)
          );
          //
          moveCon.appendChild(toggle);

          //
          line = document.createElement("div");
          line.style = "width: 50%; height: 8px;";
          line.className =
            "border-r border-gray-700 dark:border-gray-100" +
            (invisible ? " hidden" : "");

          moveCon.appendChild(line);
        }

        sp.appendChild(moveCon);

        var ftr = this.loadRoadmap(roadmap[i].lines, depth + 1, hidden);
        sp.appendChild(ftr);
      } else {
        sp.appendChild(moveCon);
      }

      div.appendChild(sp);
    }

    return div;
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var roadmap = new Roadmap();
});
