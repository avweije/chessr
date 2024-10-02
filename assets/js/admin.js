import { Utils } from "./utils.js";
import { Modal } from "./modal.js";

class Admin {
  // the elements
  maxLinesInput = null;
  batchSizeInput = null;
  importEvaluationsButton = null;

  elapsedTimeField = null;

  importStarted = false;
  interruptImport = false;

  startTime = null;
  intervalId = null;
  processed = 0;
  average = 0;

  startTimeLatest = null;
  averageLatest = 0;

  constructor() {
    // get the elements
    this.maxLinesInput = document.getElementById("maxLinesInput");
    this.batchSizeInput = document.getElementById("batchSizeInput");
    this.importEvaluationsButton = document.getElementById(
      "importEvaluationsButton"
    );

    this.linesImportedField = document.getElementById("linesImportedField");
    this.elapsedTimeField = document.getElementById("elapsedTimeField");

    // attach event handlers
    this.importEvaluationsButton.addEventListener(
      "click",
      this.onStartStop.bind(this)
    );
  }

  onStartStop() {
    console.log("onStartStop: " + (this.importStarted ? "stop" : "start"));

    // if the import is running
    if (this.importStarted) {
      // stop the import
      this.stopImport();
    } else {
      // start the import
      this.startImport();
    }

    this.importStarted = !this.importStarted;
  }

  // stop the import
  stopImport() {
    this.interruptImport = true;
    this.importEvaluationsButton.disabled = true;
  }

  //
  startImport() {
    // show the spinner
    this.importEvaluationsButton.children[0].innerHTML = "Stop import";
    this.importEvaluationsButton.children[1].classList.remove("hidden");

    this.linesImportedField.innerHTML = "0";

    this.processed = 0;
    this.average = 0;

    this.averageLatest = 0;

    this.interruptImport = false;

    // get the start time
    this.startTime = new Date().getTime();

    // update the elapsed time
    this.intervalId = setInterval(() => {
      this.setElapsedTime();
    }, 1000);

    // run the import
    this.nextImport();
  }

  // start the import
  nextImport() {
    console.log("nextImport:");

    var url = "/admin/evaluations/import";

    var data = {
      maxLines: this.maxLinesInput.value,
      batchSize: this.batchSizeInput.value,
    };

    // get the start time for this fetch
    this.startTimeLatest = new Date().getTime();

    fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        console.log("Success:");
        console.log(response);

        // handle response and run next import
        this.onImportDone(response);
      })
      .catch((error) => {
        console.error("Error:", error);

        // handle response
        this.onImportDone(null);
      });
  }

  //
  onImportDone(data) {
    console.log("onImportDone:");
    console.log(data);

    var averageLoss = 0;

    // update totals
    if (data !== null) {
      var seconds = (new Date().getTime() - this.startTime) / 1000;

      this.processed += data.processed;
      this.average =
        this.processed > 0
          ? Math.round((this.processed / seconds) * 10) / 10
          : 0;

      // if not the 1st call
      if (this.processed > data.processed) {
        var secondsLatest =
          (new Date().getTime() - this.startTimeLatest) / 1000;
        this.averageLatest =
          data.processed > 0
            ? Math.round((data.processed / secondsLatest) * 10) / 10
            : 0;

        averageLoss =
          this.averageLatest < this.average
            ? 100 - (this.averageLatest / this.average) * 100
            : 0;

        console.log("averageLoss: " + averageLoss + "%");
      }

      this.linesImportedField.innerHTML =
        this.processed +
        ' <sup class="font-normal">(' +
        data.percentageComplete +
        "%)</sup>";

      // update the elapsed time
      this.setElapsedTime();
    }

    //
    if (this.interruptImport || data == null) {
      // hide the spinner, toggle button
      this.importEvaluationsButton.children[0].innerHTML = "Import eveluations";
      this.importEvaluationsButton.children[1].classList.add("hidden");
      this.importEvaluationsButton.disabled = false;

      this.importStarted = false;
      this.interruptImport = false;

      // clear the elapsed time interval
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    } else if (averageLoss > 25) {
      console.log("averageLoss > 25%, waiting 8 seconds for next call...");

      setTimeout(() => {
        this.nextImport();
      }, 8000);
    } else {
      this.nextImport();
    }
  }

  //
  setElapsedTime() {
    var seconds = (new Date().getTime() - this.startTime) / 1000;

    this.elapsedTimeField.innerHTML =
      this.getDuration(seconds) +
      (this.average > 0
        ? ' <sup class="font-normal">(' +
          this.average +
          " p/s)" +
          (this.averageLatest > 0 ? " [" + this.averageLatest + " p/s]" : "") +
          "</sup>"
        : "");
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
  var admin = new Admin();
});
