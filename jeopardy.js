// categories is the main data structure for the app; it looks like this:

//  [
//    { title: "Math",
//      clues: [
//        {question: "2+2", answer: 4, showing: null},
//        {question: "1+1", answer: 2, showing: null}
//        ...
//      ],
//    },
//    { title: "Literature",
//      clues: [
//        {question: "Hamlet Author", answer: "Shakespeare", showing: null},
//        {question: "Bell Jar Author", answer: "Plath", showing: null},
//        ...
//      ],
//    },
//    ...
//  ]

const NUM_CATEGORIES = 6;
const NUM_QUESTIONS_PER_CAT = 5;
const NUM_API_CATEGORIES = 18418;
const categorySet = new Set();

let categories = [];

/** Get NUM_CATEGORIES random category from API.
 *
 * Returns array of category ids
 */

async function getCategoryIDs() {
  for (let x = 0; x < NUM_CATEGORIES; x++) {
    let categoryObj = await getCategory(getRandomID());
    verifyCategory(categoryObj)
      ? (categories[x] = shortenCategory(categoryObj))
      : x--;
  }
  return categories;
}

/** From testing with the jService API, category IDs start at 1 and
 *  end at 18418.
 */
function getRandomID() {
  let randomID = 1 + Math.floor(Math.random() * NUM_API_CATEGORIES);
  while (categorySet.has(randomID)) {
    randomID = 1 + Math.floor(Math.random() * NUM_API_CATEGORIES);
  }
  return randomID;
}

/** Ensures that the given category has enough clues for the set number
 *  of game rows, and that the clues are not invalid (ie rely on in-person
 *  tips like pictures or sounds).
 */
function verifyCategory(categoryObj) {
  let enoughGameClues = categoryObj.clues_count >= NUM_QUESTIONS_PER_CAT;
  let noInvalidClues = categoryObj.clues.every((element) => {
    return element.invalid_count === null && element.question !== "";
  });
  return enoughGameClues && noInvalidClues;
}

function shortenCategory(categoryObj) {
  let { title, clues } = categoryObj;
  let shortenedClues = [];
  for (let clue of clues) {
    let { question, answer } = clue;
    shortenedClues.push({
      question: removeHTML(question),
      answer: removeHTML(answer),
      showing: null,
    });
  }
  return { title: removeHTML(title), clues: shortenedClues };
}

function removeHTML(htmlString) {
  let parser = new DOMParser();
  return parser
    .parseFromString(htmlString, "text/html")
    .body.textContent.toUpperCase();
}

/** Return object with data about a category:
 *
 *  Returns { title: "Math", clues: clue-array }
 *
 * Where clue-array is:
 *   [
 *      {question: "Hamlet Author", answer: "Shakespeare", showing: null},
 *      {question: "Bell Jar Author", answer: "Plath", showing: null},
 *      ...
 *   ]
 */

async function getCategory(catId) {
  let categoryObj = await fetch(
    `https://jservice.io/api/category?id=${catId}`
  ).then((response) => response.json());
  return categoryObj;
}

/** Fill the HTML table#jeopardy with the categories & cells for questions.
 *
 * - The <thead> should be filled w/a <tr>, and a <td> for each category
 * - The <tbody> should be filled w/NUM_QUESTIONS_PER_CAT <tr>s,
 *   each with a question for each category in a <td>
 *   (initally, just show a "?" where the question/answer would go.)
 */

async function fillTable() {
  const $table = $("#jeopardy");
  const $tableHead = $("<thead><tr>");
  const $tableBody = $("<tbody>");
  for (let category of categories) {
    $tableHead
      .find("tr")
      .append($(`<td class="category-title">${category.title}</td>`));
  }
  for (let x = 0; x < NUM_QUESTIONS_PER_CAT; x++) {
    const $questionRow = $("<tr>");
    for (let y = 0; y < NUM_CATEGORIES; y++) {
      const $clue = $(`<td class="clue">?</td>`);
      $clue.data({ categoryIndex: y, clueIndex: x });
      $questionRow.append($clue);
    }
    $tableBody.append($questionRow);
  }
  $table.append($tableHead);
  $table.append($tableBody);
}

/** Handle clicking on a clue: show the question or answer.
 *
 * Uses .showing property on clue to determine what to show:
 * - if currently null, show question & set .showing to "question"
 * - if currently "question", show answer & set .showing to "answer"
 * - if currently "answer", ignore click
 * */

function handleClick(evt) {
  const $clue = $(evt.target);
  let { categoryIndex, clueIndex } = $clue.data();
  let clueInfo = categories[categoryIndex].clues[clueIndex];
  if (clueInfo.showing === "answer") {
    return;
  } else if (clueInfo.showing === null) {
    clueInfo.showing = "question";
    $clue.text(clueInfo.question);
    return;
  } else if (clueInfo.showing === "question") {
    clueInfo.showing = "answer";
    $clue.text(clueInfo.answer);
    return;
  }
}

/** Wipe the current Jeopardy board, show the loading spinner,
 * and update the button used to fetch data.
 */

/** Note - implemented here for completeness, but showLoadingView and
 *  hideLoadingView could be simplified by using the jQuery toggle()
 *  function on the elements changing visibility in a single
 *  toggleLoadingState() function instead.
 *
 */
function showLoadingView() {
  $("#jeopardy").hide();
  $("#restart").hide();
  $(".loading").show();
}

/** Remove the loading spinner and update the button used to fetch data. */

function hideLoadingView() {
  $("#jeopardy").show();
  $("#restart").show();
  $(".loading").hide();
}

/** Start game:
 *
 * - get random category Ids
 * - get data for each category
 * - create HTML table
 * */

/** Note - normally, I would create the button in the HTML file instead of
 *  in the JS code, however the given instructions state:
 *    "We’ve provided an HTML file and CSS for the application
 *     (you shouldn’t change the HTML file; if you want to tweak
 *     any CSS things, feel free to)."
 */
async function setupAndStart() {
  const $loadingCircle = $(`<div class="loading">`);
  $("body").append($loadingCircle);
  await getCategoryIDs().then(function () {
    const $gameTable = $('<table id="jeopardy">').hide();
    const $restartButton = $('<button id="restart">Restart</button>').hide();
    $restartButton.on("click", restart);
    $("body").append([$gameTable, $restartButton]);
    fillTable();
    hideLoadingView();
  });
}

/** On click of start / restart button, set up game. */

async function restart() {
  showLoadingView();
  $("#jeopardy").empty();
  await getCategoryIDs().then(function () {
    fillTable();
    hideLoadingView();
  });
}

/** On page load, add event handler for clicking clues */

/** Note - this could have been done using a listener for the "load" or
 * "DOMContentLoaded" events to trigger adding the event handler. I opted
 *  to use event delegation instead, as it means only one event handler is
 *  needed, rather than adding one handler to trigger adding another.
 */
$("body").on("click", ".clue", handleClick);

setupAndStart();
