// Import the dependencies
const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");
const moment = require("moment");
const cronofyClient = require("./config");

// Enable dotenv
dotenv.config();

// Setup

const PORT = process.env.PORT || 7070;
const ORIGIN = process.env.ORIGIN || `http://localhost:${PORT}`;
const CALLBACK_URL = process.env.CALLBACK_URL || `${ORIGIN}/callback-url`;

const contacts = [
  {
    name: "John Doe",
    id: "1",
    number: "+1234567890",
    language: "en",
  },
  {
    name: "Jane Doe",
    id: "2",
    number: "+0987654321",
    language: "es",
  },
];

// Setup Express
const app = express();
app.set("view engine", "ejs");
app.set("views", process.cwd() + "/app/templates");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(__dirname + "/"));

// Add the Cronofy client setup here
app.get("/", async (req, res) => {
  const codeQuery = req.query.code;

  if (codeQuery) {
    const codeResponse = await cronofyClient
      .requestAccessToken({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code: codeQuery,
        redirect_uri: ORIGIN,
      })
      .catch((err) => {
        if (err.error === "invalid_grant" || err.message === "invalid_grant") {
          console.warn(
            "\x1b[33m",
            "\nWARNING:\nThere was a problem validating the `code` response. The provided code is not known, has been used, or was not paired with the provided redirect_uri.\n",
            "\x1b[0m"
          );
        } else {
          console.warn(
            "\x1b[33m",
            "\nWARNING:\nThere was a problem validating the `code` response. Check that your CLIENT_ID, CLIENT_SECRET, and SUB environment variables are correct.\n",
            "\x1b[0m"
          );
        }
      });

    console.log(codeResponse);
  }

  const token = await cronofyClient
    .requestElementToken({
      version: "1",
      permissions: ["managed_availability", "account_management", "agenda"],
      subs: [process.env.SUB],
      origin: ORIGIN,
    })
    .catch(() => {
      console.error(
        "\x1b[31m",
        "\nERROR:\nThere was a problem generating the element token. Check that your CLIENT_ID, CLIENT_SECRET, and SUB environment variables are correct.\n",
        "\x1b[0m"
      );
      return { element_token: { token: "invalid" } };
    });

  return res.render("home", {
    element_token: token.element_token.token,
    client_id: process.env.CLIENT_ID,
    data_center: process.env.DATA_CENTER,
  });
});

// Define an endpoint to handle button clicks
// Route to handle button click
app.post("/real-time-schedule-click", async (req, res) => {
  console.log("Button was clicked!");
  console.log("Received data:", req.body);

  const userInfo = await cronofyClient.userInfo();
  const calendarId =
    userInfo["cronofy.data"].profiles[0].profile_calendars[0].calendar_id;

  let urls = [];

  for (let index = 0; index < contacts.length; index++) {
    let r = await cronofyClient
      .realTimeScheduling({
        oauth: {
          redirect_uri: ORIGIN,
        },
        event: {
          event_id: "booking_demo_event",
          summary: "Demo meeting",
          description: "The Cronofy developer demo has created this event",
          tzid: "Etc/UTC",
        },
        start: "2024-12-13T12:00:00Z",
        end: "2024-12-13T20:00:00Z",
        required_duration: { minutes: 60 },
        availability: {
          participants: [
            {
              members: [
                {
                  sub: process.env.SUB,
                  calendar_ids: [calendarId],
                },
              ],
              required: "all",
              managed_availability: true,
            },
          ],
          required_duration: {
            minutes: 30,
          },
          available_periods: [
            {
              start: "2024-12-11T12:00:00Z",
              end: "2024-12-11T20:00:00Z",
            },
          ],
        },
        target_calendars: [
          {
            sub: process.env.SUB,
            calendar_id: calendarId,
            attendee: {
              email: "pablo@talkingpts.org",
              display_name: "Pablo Marquez",
            },
          },
        ],
        callback_url: CALLBACK_URL + "?id=" + contacts[index].id,
        event_creation: "single",
      })
      .then((response) => {
        const contact = contacts[index];
        urls.push(
          response.real_time_scheduling.url + "?locale=" + contact.language
        );
        console.log(response);
      })
      .catch((err) => {
        if (err.error === "invalid_grant" || err.message === "invalid_grant") {
          console.warn(
            "\x1b[33m",
            "\nWARNING:\nThere was a problem validating the `code` response. The provided code is not known, has been used, or was not paired with the provided redirect_uri.\n",
            "\x1b[0m"
          );
        } else {
          console.warn(
            "\x1b[33m",
            "\nWARNING:\nThere was a problem validating the `code` response. Check that your CLIENT_ID, CLIENT_SECRET, and SUB environment variables are correct.\n",
            "\x1b[0m"
          );
        }
      });
  }

  if (urls.length > 0) {
    let message = "Event scheduled successfully";
    if (urls.length > 1) {
      message = "Events scheduled successfully";
    }
    for (let index = 0; index < urls.length; index++) {
      const url = urls[index];
      message += `\n${url}`;
    }
    res.json({ message: message, urls: urls, contacts: contacts });
  } else {
    res.status(500).json({ error: "Failed to schedule event" });
  }
  // Send a response back to the client
});

// Route: availability
app.get("/availability", async (req, res) => {
  const token = await cronofyClient.requestElementToken({
    version: "1",
    permissions: ["availability"],
    subs: [process.env.SUB],
    origin: ORIGIN,
  });

  return res.render("availability", {
    element_token: token.element_token.token,
    sub: process.env.SUB,
    data_center: process.env.DATA_CENTER,
  });
});

// Route: submit
app.get("/submit", async (req, res) => {
  // Get the `slot` data from the query string
  const slot =
    typeof req.query.slot === "string" ? JSON.parse(req.query.slot) : null;

  const userInfo = await cronofyClient.userInfo();
  const calendarId =
    userInfo["cronofy.data"].profiles[0].profile_calendars[0].calendar_id;

  cronofyClient.createEvent({
    calendar_id: calendarId,
    event_id: "booking_demo_event",
    summary: "Demo meeting",
    description: "The Cronofy developer demo has created this event",
    start: slot.start,
    end: slot.end,
  });

  // let r = cronofyClient.realTimeScheduling(
  //   {
  //     calendar_id: calendarId,
  //     event_id: "booking_demo_event",
  //     summary: "Demo meeting",
  //     description: "The Cronofy developer demo has created this event",
  //     start: slot.start,
  //     end: slot.end,
  //     availability_rule: {
  //       participants: [
  //         {
  //           required: "all",
  //           members: [
  //             {
  //               sub: process.env.SUB,
  //               managed_availability: true,
  //             },
  //           ],
  //         },
  //       ],
  //     },
  //   },
  //   () => {}
  // );

  // console.log(r);

  const meetingDate = moment(slot.start).format("DD MMM YYYY");
  const start = moment(slot.start).format("LT");
  const end = moment(slot.end).format("LT");

  return res.render("submit", {
    meetingDate,
    start,
    end,
  });
});

app.post("/callback-url", async (req, res) => {
  const contactId = req.query.id;
  const contact =
    contacts[
      parseInt(typeof req.query.id === "string" ? req.query.id : "1") - 1
    ];

  console.log(
    "Received callback:",
    req.body,
    "contactId = " + contactId,
    "contact = ",
    contact?.name
  );

  // update the event to the calendar
  const userInfo = await cronofyClient.userInfo();
  const calendarId =
    userInfo["cronofy.data"].profiles[0].profile_calendars[0].calendar_id;

  const event = req.body.event;
  const eventId = event.event_id;
  const start = event.start;
  const end = event.end;
  const summary = event.summary + " with " + contact.name;
  const description = event.description;
  const tzid = event.tzid;

  const r = await cronofyClient.createEvent({
    calendar_id: calendarId,
    event_id: eventId,
    summary: summary,
    description: description,
    start: start,
    end: end,
    tzid: tzid,
  });

  // Send a response to acknowledge the callback
  res.status(200).send("Callback received");
});

app.listen(PORT);
console.log(`serving on ${ORIGIN}`);
