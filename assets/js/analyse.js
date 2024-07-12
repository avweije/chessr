class Analyse {
  // the buttons
  connectButton = null;
  downloadButton = null;
  analyseButton = null;

  constructor() {
    // get the buttons
    this.connectButton = document.getElementById("connectButton");
    this.downloadButton = document.getElementById("downloadButton");
    this.analyseButton = document.getElementById("analyseButton");

    // get the practice type
    //this.type = el.getAttribute("data-type");

    // toggle the buttons
    this.connectButton.disabled = false;
    this.downloadButton.disabled = true;
    this.analyseButton.disabled = true;

    // attach click handler to the buttons
    this.connectButton.addEventListener("click", this.getArchives.bind(this));
    this.downloadButton.addEventListener("click", this.getGames.bind(this));
    this.analyseButton.addEventListener("click", this.analyseGames.bind(this));
  }

  // get the archives
  onConnectClick(event) {
    console.log("onConnectClick:");
  }

  // get the games
  onDownloadClick(event) {
    console.log("onDownloadClick:");
  }

  // analyse the games
  onAnalyseClick(event) {
    console.log("onAnalyseClick:");
  }

  // get the repertoire
  getArchives() {
    console.log("getArchives:");

    var url = "/api/practice";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // enable the practice
        this.onGetRepertoire(response);
      })
      .catch((error) => console.error("Error:", error));
  }

  // enable the practice
  onGetRepertoire(json) {
    this.repertoire = json;
    // enable the start practice button
    this.startPracticeButton.disabled = false;
    // toggle the repertoire type buttons
    this.toggleRepertoireButtons();
  }

  //
  getGames() {
    console.log("getGames:");
  }

  //
  analyseGames() {
    console.log("analyseGames:");
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var analyse = new Analyse();
});
