import { Modal } from "./modal.js";

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

  analyseDialog = {
    modal: null,
    typeField: null,
    gamesField: null,
    elapsedTimeField: null,
    estimatedTimeField: null,
    stopButton: null,
    closeButton: null,
    startTime: null,
    intervalId: null,
    inProgress: false,
    isCancelled: false,
    processed: 0,
    totals: [],
  };

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

    // get the modal elements
    this.analyseDialog.modal = document.getElementById("analyseModal");

    var fields = this.analyseDialog.modal.getElementsByTagName("p");

    this.analyseDialog.typeField = fields[0];
    this.analyseDialog.gamesField = fields[1];
    this.analyseDialog.elapsedTimeField = fields[2];
    this.analyseDialog.estimatedTimeField = fields[3];
    this.analyseDialog.stopButton = document.getElementById(
      "analyseModalStopButton"
    );
    this.analyseDialog.closeButton = document.getElementById(
      "analyseModalCloseButton"
    );

    // register the modal
    Modal.register(
      this.analyseDialog.modal,
      [
        {
          element: this.analyseDialog.closeButton,
          action: "close",
        },
        {
          element: this.analyseDialog.stopButton,
          action: "close",
        },
      ],
      this.onCloseDialog.bind(this)
    );
  }

  // get the repertoire
  getArchives() {
    console.log("getArchives:");

    var url = "/api/download/archives";

    // show the spinner
    this.connectButton.children[0].classList.remove("hidden");

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // hide the spinner
        this.connectButton.children[0].classList.add("hidden");

        // handle the response
        this.onGetArchives(response);
      })
      .catch((error) => {
        console.error("Error:", error);

        // hide the spinner
        this.connectButton.children[0].classList.add("hidden");
      });
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

    // show the spinner
    this.downloadButton.children[0].classList.remove("hidden");

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

        // hide the spinner
        this.downloadButton.children[0].classList.add("hidden");

        // handle the response
        this.onGetGames(response);
      })
      .catch((error) => {
        console.error("Error:", error);

        // hide the spinner
        this.downloadButton.children[0].classList.add("hidden");
      });
  }

  // show the totals, enable analyse
  onGetGames(json) {
    this.games = json["games"];

    // show the archives container..

    // clear the type select
    while (this.gameTypeSelect.firstChild) {
      this.gameTypeSelect.removeChild(this.gameTypeSelect.lastChild);
    }

    // reset the totals per type
    this.analyseDialog.totals = [];

    // fill the type select
    for (var [key, totals] of Object.entries(this.games)) {
      var opt = document.createElement("option");
      opt.value = key;
      opt.text =
        key.charAt(0).toUpperCase() +
        key.slice(1) +
        " (" +
        (totals.total - totals.processed) +
        ")";

      this.gameTypeSelect.appendChild(opt);

      // keep track of the totals for this type
      this.analyseDialog.totals[key] = totals;
    }

    // enable the analyse button
    if (!this.analyseDialog.inProgress) {
      this.analyseButton.disabled = false;
    }

    // hide the text, show the container
    this.gamesDisabledText.classList.add("hidden");
    this.gamesContainer.classList.remove("hidden");
  }

  // start analysing the games
  analyseGames() {
    console.log("analyseGames:");

    console.log("cancelled: " + this.analyseDialog.isCancelled);
    console.log(this.gameTypeSelect.value);
    console.log(this.archiveYearSelect.value);
    console.log(this.archiveMonthSelect.value);

    // show the spinner
    this.analyseButton.children[0].classList.remove("hidden");

    // disable the analyse button
    this.analyseButton.disabled = true;

    // if the last run is still in progress
    if (this.analyseDialog.inProgress) {
      return false;
    }

    // initialise the analyse process
    this.analyseDialog.isCancelled = false;
    this.analyseDialog.inProgress = true;
    this.analyseDialog.processed = 0;

    // set the type of games
    this.analyseDialog.typeField.innerHTML =
      this.gameTypeSelect.value.charAt(0).toUpperCase() +
      this.gameTypeSelect.value.slice(1);

    // set the estimated time

    // set the stop button text
    this.analyseDialog.stopButton.innerHTML = "Stop analysing";

    // open the dialog
    Modal.open(this.analyseDialog.modal);

    // get the start time
    this.analyseDialog.startTime = new Date().getTime();

    // update the elapsed time
    this.analyseDialog.intervalId = setInterval(() => {
      var seconds =
        (new Date().getTime() - this.analyseDialog.startTime) / 1000;

      this.analyseDialog.elapsedTimeField.innerHTML = this.getDuration(seconds);
    }, 1000);

    // start analysing
    this.analyseNext();
  }

  // called when the dialog gets closed (return false to cancel)
  onCloseDialog() {
    // stop the interval timer
    if (this.analyseDialog.intervalId) {
      clearInterval(this.analyseDialog.intervalId);
      this.analyseDialog.intervalId = null;
    }

    this.analyseDialog.isCancelled = true;

    return true;
  }

  // analyse the next set of games
  analyseNext() {
    console.log("analyseNext:");

    console.log("cancelled: " + this.analyseDialog.isCancelled);
    console.log(this.archiveYearSelect.value);
    console.log(this.archiveMonthSelect.value);

    // if cancelled, don't proceed
    if (this.analyseDialog.isCancelled) {
      // no longer in progress
      this.analyseDialog.inProgress = false;
      // enable the analyse button
      this.analyseButton.disabled = false;
      // hide the spinner
      this.analyseButton.children[0].classList.add("hidden");

      // get the games
      this.getGames();

      return false;
    }

    // if we have no more games left to process
    if (
      this.analyseDialog.totals[this.gameTypeSelect.value].processed ==
      this.analyseDialog.totals[this.gameTypeSelect.value].total
    ) {
      // update the games field
      this.analyseDialog.gamesField.innerHTML =
        "All games have been processed.";
      // clear the interval
      if (this.analyseDialog.intervalId) {
        clearInterval(this.analyseDialog.intervalId);
        this.analyseDialog.intervalId = null;
      }

      // update the stop button text
      this.analyseDialog.stopButton.innerHTML = "Close";
      // enable the analyse button
      this.analyseButton.disabled = false;
      // hide the spinner
      this.analyseButton.children[0].classList.add("hidden");

      return;
    }

    // update the games field
    this.analyseDialog.gamesField.innerHTML =
      this.analyseDialog.totals[this.gameTypeSelect.value].total +
      " in total, " +
      (this.analyseDialog.totals[this.gameTypeSelect.value].total -
        this.analyseDialog.totals[this.gameTypeSelect.value].processed) +
      " remaining";

    // get the elapsed time so far
    var elapsed = (new Date().getTime() - this.analyseDialog.startTime) / 1000;
    // get the average time per game
    var estimate =
      this.analyseDialog.processed > 0
        ? elapsed / this.analyseDialog.processed
        : 15;
    // update the estimated time left field
    this.analyseDialog.estimatedTimeField.innerHTML = this.getDuration(
      estimate *
        (this.analyseDialog.totals[this.gameTypeSelect.value].total -
          this.analyseDialog.totals[this.gameTypeSelect.value].processed)
    );

    console.log("elapsed: " + elapsed);
    console.log("estimate per game: " + estimate);
    console.log(
      "games left: " +
        (this.analyseDialog.totals[this.gameTypeSelect.value].total -
          this.analyseDialog.totals[this.gameTypeSelect.value].processed)
    );

    //var url = "/api/download/games/{year}/{month}";
    var url =
      "/api/analyse/" +
      this.gameTypeSelect.value +
      "/" +
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

        // update the totals
        this.analyseDialog.processed =
          this.analyseDialog.processed + response.processed;
        this.analyseDialog.totals[this.gameTypeSelect.value].processed =
          this.analyseDialog.totals[this.gameTypeSelect.value].processed +
          response.processed;

        // analyse the next set of games
        this.analyseNext();
      })
      .catch((error) => {
        console.error("Error:", error);

        // hide the spinner
        this.analyseButton.children[0].classList.add("hidden");
      });
  }

  // get a printable duration for a number of seconds (2h 14m 32s)
  getDuration(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds - h * 3600) / 60);
    var s = Math.floor(seconds - h * 3600 - m * 60);

    return (h > 0 ? h + "h " : "") + (h > 0 || m > 0 ? m + "m " : "") + s + "s";
  }
}

// initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  var analyse = new Analyse();
});
