import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

class Analyse {
  // the elements
  siteChessDotComRadio = null;
  siteLichessRadio = null;

  siteUsername = null;

  connectButton = null;
  downloadButton = null;
  analyseButton = null;

  archivesSection = null;
  archivesDisabledText = null;
  archivesContainer = null;
  archiveYearSelect = null;
  archiveMonthSelect = null;

  gamesSection = null;
  gamesDisabledText = null;
  gamesContainer = null;
  gameTypeSelect = null;

  archiveYear = 0;
  archiveMonth = 0;

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
    year: 0,
    month: 0,
    totals: [],
  };

  // the settings
  settings = [];

  // the data
  archives = [];
  games = [];

  constructor() {
    // get the elements
    this.siteChessDotComRadio = document.getElementById("siteChessDotComRadio");
    this.siteLichessRadio = document.getElementById("siteLichessRadio");

    this.siteUsername = document.getElementById("siteUsername");

    this.connectButton = document.getElementById("connectButton");
    this.downloadButton = document.getElementById("downloadButton");
    this.analyseButton = document.getElementById("analyseButton");

    this.archivesSection = document.getElementById("archivesSection");
    this.archivesDisabledText = document.getElementById("archivesDisabledText");
    this.archivesContainer = document.getElementById("archivesContainer");
    this.archiveYearSelect = document.getElementById("archiveYearSelect");
    this.archiveMonthSelect = document.getElementById("archiveMonthSelect");

    this.gamesSection = document.getElementById("gamesSection");
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
    this.siteChessDotComRadio.addEventListener(
      "change",
      this.switchSite.bind(this)
    );
    this.siteLichessRadio.addEventListener(
      "change",
      this.switchSite.bind(this)
    );

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

    console.log(this.analyseDialog);

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

    // get settings
    this.getSettings();
  }

  // get the settings
  getSettings() {
    console.log("getSettings:");

    var url = "/api/download/settings";

    // show the page loader
    Utils.showLoading();

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // handle the response
        this.onGetSettings(response["settings"]);
      })
      .catch((error) => {
        console.error("Error:", error);
      })
      .finally(() => {
        // hide the page loader
        Utils.hideLoading();
      });
  }

  //
  onGetSettings(settings) {
    console.log("onGetSettings:");
    console.log(settings);

    // store the settings
    this.settings = settings;

    // select the correct site
    if (this.settings.site == "Lichess") {
      this.siteLichessRadio.checked = true;

      this.siteUsername.value = this.settings.lichess_username
        ? this.settings.lichess_username
        : "";
    } else {
      this.siteChessDotComRadio.checked = true;

      this.siteUsername.value = this.settings.chess_username
        ? this.settings.chess_username
        : "";
    }
  }

  // switch sites
  switchSite() {
    // get the selected site
    this.settings.site = this.siteChessDotComRadio.checked
      ? this.siteChessDotComRadio.value
      : this.siteLichessRadio.value;

    // set the correct username
    if (this.settings.site == "Lichess") {
      // store the current username
      this.settings.chess_username = this.siteUsername.value;
      // set the lichess username
      this.siteUsername.value = this.settings.lichess_username
        ? this.settings.lichess_username
        : "";
    } else {
      // store the current username
      this.settings.lichess_username = this.siteUsername.value;
      // set the chess.com username
      this.siteUsername.value = this.settings.chess_username
        ? this.settings.chess_username
        : "";
    }

    console.log(this.settings);

    // disable the download button
    this.downloadButton.disabled = true;

    // show the text, hide the container
    this.archivesDisabledText.classList.remove("hidden");
    this.archivesContainer.classList.add("hidden");

    // hide the games
    this.gamesSection.classList.add("hidden");
  }

  // get the repertoire
  getArchives() {
    console.log("getArchives:");

    var site = this.siteChessDotComRadio.checked
      ? this.siteChessDotComRadio.value
      : this.siteLichessRadio.value;

    var url =
      "/api/download/archives/" +
      encodeURIComponent(this.siteUsername.value) +
      "/" +
      encodeURIComponent(site);

    console.log("URL: " + url);

    // show the spinner
    this.connectButton.children[0].classList.remove("hidden");
    this.connectButton.disabled = true;

    // hide the games section
    this.gamesSection.classList.add("hidden");

    fetch(url, {
      method: "GET",
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // hide the spinner
        this.connectButton.children[0].classList.add("hidden");
        this.connectButton.disabled = false;

        // handle the response
        this.onGetArchives(response);
      })
      .catch((error) => {
        console.error("Error:", error);

        // hide the spinner
        this.connectButton.children[0].classList.add("hidden");
        this.connectButton.disabled = false;
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

    // show the games section
    this.gamesSection.classList.remove("hidden");
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
    this.archiveYear = this.archiveYearSelect.value;
    this.archiveMonth = this.archiveMonthSelect.value;

    // show the spinner
    this.downloadButton.children[0].classList.remove("hidden");
    this.downloadButton.disabled = true;

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
        this.downloadButton.disabled = false;

        // handle the response
        this.onGetGames(response);
      })
      .catch((error) => {
        console.error("Error:", error);

        // hide the spinner
        this.downloadButton.children[0].classList.add("hidden");
        this.downloadButton.disabled = false;
      });
  }

  // show the totals, enable analyse
  onGetGames(json, rememberSelected = false) {
    this.games = json["games"];

    // if we need to remember the currently selected value
    var selectedValue = rememberSelected
      ? this.gameTypeSelect.options[this.gameTypeSelect.selectedIndex].value
      : "";

    // clear the type select
    while (this.gameTypeSelect.firstChild) {
      this.gameTypeSelect.removeChild(this.gameTypeSelect.lastChild);
    }

    // reset the totals per type
    this.analyseDialog.totals = [];

    // the number of types with games to analyse
    var cnt = 0;

    // fill the type select
    for (var [key, totals] of Object.entries(this.games)) {
      if (totals.total == -1 || totals.total - totals.processed > 0) {
        var opt = document.createElement("option");
        opt.value = key;
        opt.text =
          key.charAt(0).toUpperCase() +
          key.slice(1) +
          (totals.total == -1
            ? ""
            : " (" + (totals.total - totals.processed) + ")");

        if (rememberSelected && key == selectedValue) {
          opt.selected = true;
        }

        this.gameTypeSelect.appendChild(opt);

        cnt++;
      }

      // keep track of the totals for this type
      this.analyseDialog.totals[key] = totals;
    }

    // if no games to analyse
    if (cnt == 0) {
      var opt = document.createElement("option");
      opt.text = "No games left to analyse";

      this.gameTypeSelect.appendChild(opt);
    }

    // enable the analyse button
    if (!this.analyseDialog.inProgress && cnt > 0) {
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
    console.log("inProgress: " + this.analyseDialog.inProgress);
    console.log(this.gameTypeSelect.value);
    console.log(this.archiveYearSelect.value);
    console.log(this.archiveMonthSelect.value);

    // if the last run is still in progress
    if (this.analyseDialog.inProgress) {
      return false;
    }

    // show the spinner
    this.analyseButton.children[0].classList.remove("hidden");
    this.analyseButton.disabled = true;

    // initialise the analyse process
    this.analyseDialog.isCancelled = false;
    this.analyseDialog.inProgress = true;
    this.analyseDialog.processed = 0;

    // set the type of games
    this.analyseDialog.typeField.innerHTML =
      this.gameTypeSelect.value.charAt(0).toUpperCase() +
      this.gameTypeSelect.value.slice(1);

    // set the elapsed time
    this.analyseDialog.elapsedTimeField.innerHTML = "0s";

    // set the stop button text
    this.analyseDialog.stopButton.innerHTML = "Stop analysing";

    // if this is lichess (no estimated time left)
    if (this.siteLichessRadio.checked) {
      console.log("estimatedTimeField:");
      console.log(this.analyseDialog.estimatedTimeField.previousElementSibling);

      this.analyseDialog.estimatedTimeField.classList.add("hidden");
      this.analyseDialog.estimatedTimeField.previousElementSibling.classList.add(
        "hidden"
      );
    }

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
    this.analyseNext(this.archiveYear, this.archiveMonth);
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
  analyseNext(year, month) {
    console.log("analyseNext:");

    console.log("cancelled: " + this.analyseDialog.isCancelled);
    console.log(year);
    console.log(month);

    // if cancelled, don't proceed
    if (this.analyseDialog.isCancelled) {
      // end the progress
      this.analyseEndProgress();

      // reload the games dropdown (if they same year & month are still showing)
      if (year == this.archiveYear && month == this.archiveMonth) {
        this.onGetGames({ games: this.games }, true);
      }

      return false;
    }

    // if we have no more games left to process
    if (
      this.analyseDialog.totals[this.gameTypeSelect.value].total != -1 &&
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
      this.analyseDialog.stopButton.classList.remove("btn-warning");
      this.analyseDialog.stopButton.classList.add("btn-primary");
      // end the progress
      this.analyseEndProgress();

      // reload the games dropdown (if they same year & month are still showing)
      if (year == this.archiveYear && month == this.archiveMonth) {
        this.onGetGames({ games: this.games }, true);
      }

      return;
    }

    // if we have estimated time left
    if (this.siteChessDotComRadio.checked) {
      // update the games field
      this.analyseDialog.gamesField.innerHTML =
        this.analyseDialog.totals[this.gameTypeSelect.value].total +
        " in total, " +
        (this.analyseDialog.totals[this.gameTypeSelect.value].total -
          this.analyseDialog.totals[this.gameTypeSelect.value].processed) +
        " remaining";

      // get the elapsed time so far
      var elapsed =
        (new Date().getTime() - this.analyseDialog.startTime) / 1000;
      // get the average time per game
      var estimate =
        this.analyseDialog.processed > 0
          ? elapsed / this.analyseDialog.processed
          : 15;
      // update the estimated time left field
      this.analyseDialog.estimatedTimeField.innerHTML = this.getDuration(
        estimate *
          (this.analyseDialog.totals[this.gameTypeSelect.value].total -
            this.analyseDialog.totals[this.gameTypeSelect.value].processed +
            this.analyseDialog.processed)
      );

      console.log("elapsed: " + elapsed);
      console.log("estimate per game: " + estimate);
      console.log(
        "games left: " +
          (this.analyseDialog.totals[this.gameTypeSelect.value].total -
            this.analyseDialog.totals[this.gameTypeSelect.value].processed)
      );
    } else {
      // update the games field
      this.analyseDialog.gamesField.innerHTML =
        this.analyseDialog.totals[this.gameTypeSelect.value].processed > 0
          ? this.analyseDialog.totals[this.gameTypeSelect.value].processed +
            " games processed"
          : "processing games";
    }

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
      .then((res) => {
        // if not a 200
        if (res.status !== 200) {
          throw new Error(res.error ? res.error : "Received an error.");
        }

        return res.json();
      })
      .then((response) => {
        console.log("Success: " + response.status);
        console.log(response);

        // update the totals
        this.analyseDialog.processed =
          this.analyseDialog.processed + response.processed;
        this.analyseDialog.totals[this.gameTypeSelect.value].processed =
          this.analyseDialog.totals[this.gameTypeSelect.value].processed +
          response.processed;

        // if completed, set the total (needed for lichess to end the analysis)
        if (response.completed) {
          this.analyseDialog.totals[this.gameTypeSelect.value].total =
            this.analyseDialog.totals[this.gameTypeSelect.value].processed;
        }

        // analyse the next set of games
        this.analyseNext(year, month);
      })
      .catch((error) => {
        console.error("Error:", error);

        // end the progress
        this.analyseEndProgress();
      });
  }

  // analyse end progress
  analyseEndProgress() {
    // no longer in progress
    this.analyseDialog.inProgress = false;
    // hide the spinner
    this.analyseButton.children[0].classList.add("hidden");
    this.analyseButton.disabled = false;
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
