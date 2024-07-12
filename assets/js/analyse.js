class Analyse {
  // the elements
  connectButton = null;
  downloadButton = null;
  analyseButton = null;

  archivesDisabledText = null;
  archivesContainer = null;
  archiveYearSelect = null;
  archiveMonthSelect = null;

  gamesDisabledText = null;
  gamesContainer = null;
  gameTypeSelect = null;

  // the data
  archives = [];
  games = [];

  constructor() {
    // get the elements
    this.connectButton = document.getElementById("connectButton");
    this.downloadButton = document.getElementById("downloadButton");
    this.analyseButton = document.getElementById("analyseButton");

    this.archivesDisabledText = document.getElementById("archivesDisabledText");
    this.archivesContainer = document.getElementById("archivesContainer");
    this.archiveYearSelect = document.getElementById("archiveYearSelect");
    this.archiveMonthSelect = document.getElementById("archiveMonthSelect");

    this.gamesDisabledText = document.getElementById("gamesDisabledText");
    this.gamesContainer = document.getElementById("gamesContainer");
    this.gameTypeSelect = document.getElementById("gameTypeSelect");

    // get the practice type
    //this.type = el.getAttribute("data-type");

    // toggle the buttons
    this.connectButton.disabled = false;
    this.downloadButton.disabled = true;
    this.analyseButton.disabled = true;

    // attach event handlers
    this.connectButton.addEventListener("click", this.getArchives.bind(this));
    this.downloadButton.addEventListener("click", this.getGames.bind(this));
    this.analyseButton.addEventListener("click", this.analyseGames.bind(this));

    this.archiveYearSelect.addEventListener(
      "change",
      this.onArchiveYearChange.bind(this)
    );
  }

  // get the repertoire
  getArchives() {
    console.log("getArchives:");

    var url = "/api/download/archives";

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // handle the response
        this.onGetArchives(response);
      })
      .catch((error) => console.error("Error:", error));
  }

  // show the archives, enable download
  onGetArchives(json) {
    this.archives = json["archives"];

    // get the years
    var years = Object.keys(this.archives);
    // sort reverse
    years.sort();
    years.reverse();

    console.log("years sorted:");
    console.log(years);

    // clear the year select
    while (this.archiveYearSelect.firstChild) {
      this.archiveYearSelect.removeChild(this.archiveYearSelect.lastChild);
    }

    // fill the year select
    for (var i = 0; i < years.length; i++) {
      var opt = document.createElement("option");
      opt.text = years[i];

      this.archiveYearSelect.appendChild(opt);
    }

    this.fillArchiveMonths(years[0]);

    // enable the download button
    this.downloadButton.disabled = false;

    // hide the text, show the container
    this.archivesDisabledText.classList.add("hidden");
    this.archivesContainer.classList.remove("hidden");
  }

  // fired when the user selects a different year
  onArchiveYearChange(event) {
    console.log("onArchiveYearChange:");
    console.log(event.target.value);

    // fill the archive months
    this.fillArchiveMonths(event.target.value);
  }

  // fill the archive months select box
  fillArchiveMonths(year) {
    console.log("fillArchiveMonths: " + year);

    // clear the month select
    while (this.archiveMonthSelect.firstChild) {
      this.archiveMonthSelect.removeChild(this.archiveMonthSelect.lastChild);
    }

    // get the months
    var months = this.archives[year];
    // sort in reverse
    months.sort();
    months.reverse();

    // fill the month select
    for (var i = 0; i < months.length; i++) {
      var opt = document.createElement("option");
      opt.text = months[i];

      this.archiveMonthSelect.appendChild(opt);
    }
  }

  // show the game totals, enable analyse
  getGames() {
    console.log("getGames:");

    // get the year & month
    console.log(this.archiveYearSelect.value);
    console.log(this.archiveMonthSelect.value);

    //var url = "/api/download/games/{year}/{month}";
    var url =
      "/api/download/games/" +
      this.archiveYearSelect.value +
      "/" +
      this.archiveMonthSelect.value;

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // handle the response
        this.onGetGames(response);
      })
      .catch((error) => console.error("Error:", error));
  }

  // show the totals, enable analyse
  onGetGames(json) {
    this.games = json["games"];

    // show the archives container..

    // clear the type select
    while (this.gameTypeSelect.firstChild) {
      this.gameTypeSelect.removeChild(this.gameTypeSelect.lastChild);
    }

    // fill the type select
    for (var [key, value] of Object.entries(this.games)) {
      var opt = document.createElement("option");
      opt.value = key;
      opt.text =
        key.charAt(0).toUpperCase() + key.slice(1) + " (" + value + ")";

      this.gameTypeSelect.appendChild(opt);
    }

    // enable the analyse button
    this.analyseButton.disabled = false;

    // hide the text, show the container
    this.gamesDisabledText.classList.add("hidden");
    this.gamesContainer.classList.remove("hidden");
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
