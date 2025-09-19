import { Utils } from "utils";

/**
 * Admin controller for the admin page.
 */
class Admin {
  importStarted = false;
  interruptImport = false;

  startTime = null;
  intervalId = null;
  processed = 0;
  average = 0;

  startTimeLatest = null;
  averageLatest = 0;

  constructor() {
    // Get the elements
    this.getElements();

    // attach event handlers
    this.elements.importTypeEvaluationsRadio.addEventListener(
      "click", this.toggleImportType.bind(this)
    );
    this.elements.importTypeMoveStatsRadio.addEventListener(
      "click", this.toggleImportType.bind(this)
    );
    this.elements.importButton.addEventListener(
      "click",
      this.onStartStop.bind(this)
    );

    // Toggle import type
    this.toggleImportType();
  }

  // Uses the data-element attribute to gather all the elements needed for this JS file
  getElements() {
    // Get the data-elements for reference
    this.elements = {};
    document.querySelectorAll("[data-element]").forEach(el => {
      if (el.dataset.element !== "yes") return;
      this.elements[el.id] = el;
    });
  }

  // Get the selected import type
  getSelectedImportType() {
    return document.querySelector('input[name="import_type"]:checked').value;
  }

  // Toggle the import type
  toggleImportType() {
    if (this.elements.importTypeEvaluationsRadio.checked) {
      this.elements.maxLinesField.classList.remove("is-hidden");
      this.elements.linesImportedRow.classList.remove("is-hidden");
      this.elements.gamesProcessedRow.classList.add("is-hidden");
    } else {
      this.elements.maxLinesField.classList.add("is-hidden");
      this.elements.linesImportedRow.classList.add("is-hidden");
      this.elements.gamesProcessedRow.classList.remove("is-hidden");
    }
  }

  // Start or stop the import
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

  // Stop the import
  stopImport() {
    this.interruptImport = true;
    this.elements.importButton.disabled = true;
  }

  // Start the import
  startImport() {
    // show the spinner
    this.elements.importButton.innerHTML = "Stop import";

    this.elements.linesImportedField.innerHTML = "0";
    this.elements.gamesProcessedField.innerHTML = "0";

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

  // Start the next AJAX import run
  nextImport() {
    console.log("nextImport:");

    const url = "./admin/evaluations/import";

    const data = {
      type: this.getSelectedImportType(),
      maxLines: this.elements.maxLinesInput.value,
      batchSize: this.elements.batchSizeInput.value,
      processed: this.processed
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

  // Called after an import AJAX call is done
  onImportDone(data) {
    console.log("onImportDone:");
    console.log(data);

    let averageLoss = 0;

    // update totals
    if (data !== null) {
      const seconds = (new Date().getTime() - this.startTime) / 1000;

      // for move statistics - if processed = 0, the file has been read (manual rotate to the next in AdminController)
      if (data.processed == 0) {
        // interrupt the import
        this.interruptImport = true;
      }

      this.processed += data.processed;
      this.average =
        this.processed > 0
          ? Math.round((this.processed / seconds) * 10) / 10
          : 0;

      const secondsLatest =
        (new Date().getTime() - this.startTimeLatest) / 1000;
      this.averageLatest =
        data.processed > 0
          ? Math.round((data.processed / secondsLatest) * 10) / 10
          : 0;

      // if not the 1st call
      if (this.processed > data.processed) {
        averageLoss =
          this.averageLatest < this.average
            ? 100 - (this.averageLatest / this.average) * 100
            : 0;

        console.log("averageLoss: " + averageLoss + "%");
      }

      // Update the lines imported / games processed
      this.elements.linesImportedField.innerHTML = this.processed;

      this.elements.gamesProcessedField.innerHTML = this.processed;

      // Update the last speed and average speeds
      this.elements.lastSpeedField.innerHTML = this.averageLatest ? this.averageLatest + ' p/s' : 'n/a';
      this.elements.averageSpeedField.innerHTML = this.average ? this.average + ' p/s' : 'n/a';

      // Update the progress bar
      this.elements.progressBar.value = data.percentageComplete;

      // update the elapsed time
      this.setElapsedTime();
    }

    //
    if (this.interruptImport || data == null) {
      // hide the spinner, toggle button
      this.elements.importButton.innerHTML = "Start import";
      this.elements.importButton.disabled = false;

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
      }, 3000);
    } else {
      this.nextImport();
    }
  }

  // Update the elapsed time
  setElapsedTime() {
    const seconds = (new Date().getTime() - this.startTime) / 1000;
    this.elements.elapsedTimeField.innerHTML = Utils.getDuration(seconds);
  }
}

// Initialise the Practice object once the page is loaded
document.addEventListener("DOMContentLoaded", (event) => {
  const admin = new Admin();
});
