const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const roomModel = require("../models/Room");
const dotenv = require("dotenv").config();

mongoose.connect(process.env.MONGODB).catch((err) => console.log(err));

mongoose.connection.on("connected", () => {
  console.log("Connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("Error connecting to MongoDB:", err);
});

router.get("/rooms", async (req, res) => {
  try {
    let availableRooms;
    try {
      availableRooms = await roomModel.find();
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "Internal server error" });
    }
    return res.status(200).json({ availableRooms: availableRooms });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/rooms/:roomId", async (req, res) => {
  try {
    let roomID = req.params["roomId"];
    let room = await roomModel.findOne({ id: roomID });

    if (!room) {
      return res
        .status(404)
        .json({ message: "A room with this ID does not exist" });
    }

    return res.status(200).json({ room: room });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get(
  "/rooms/availability/checkin/:checkinDate/checkout/:checkoutDate",
  async (req, res) => {
    const requestedCheckinDate = new Date(req.params.checkinDate);
    const requestedCheckoutDate = new Date(req.params.checkoutDate);

    // Convert parsed dates to UTC
    const checkinUTC = new Date(
      Date.UTC(
        requestedCheckinDate.getFullYear(),
        requestedCheckinDate.getMonth(),
        requestedCheckinDate.getDate(),
        requestedCheckinDate.getHours(),
        requestedCheckinDate.getMinutes(),
        requestedCheckinDate.getSeconds()
      )
    );

    const checkoutUTC = new Date(
      Date.UTC(
        requestedCheckoutDate.getFullYear(),
        requestedCheckoutDate.getMonth(),
        requestedCheckoutDate.getDate(),
        requestedCheckoutDate.getHours(),
        requestedCheckoutDate.getMinutes(),
        requestedCheckoutDate.getSeconds()
      )
    );

    console.log(checkinUTC + " " + checkoutUTC);

    // Function to check if a date is valid
    function isValidDate(date) {
      return !isNaN(date.getTime()); // Check if the date is a valid date object
    }

    // Check if both check-in and check-out dates are valid
    if (!isValidDate(checkinUTC) || !isValidDate(checkoutUTC)) {
      return res.status(400).json({
        message: "Invalid check-in or check-out date",
      });
    }

    try {
      const rooms = await roomModel.find().populate("reservations");

      let availableRooms = [];

      rooms.forEach((room) => {
        let isAvailable = true;

        room.reservations.forEach((reservation) => {
          const reservationCheckinDate = new Date(reservation.checkin);
          const reservationCheckoutDate = new Date(reservation.checkout);

          if (
            requestedCheckinDate < reservationCheckoutDate &&
            requestedCheckoutDate > reservationCheckinDate
          ) {
            isAvailable = false;
          }
        });

        if (isAvailable) {
          availableRooms.push(room);
        }
      });

      console.log(availableRooms);

      return res.status(200).json({
        availableRooms: availableRooms.sort((a, b) => a.number - b.number),
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.post("/rooms/:roomId/reservation", async (req, res) => {
  function generateReservationCode() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let reservationCode = "";
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      reservationCode += characters.charAt(randomIndex);
    }
    return reservationCode;
  }

  const { name, address, city, zip, country, checkin, checkout } = req.body;

  const roomID = req.params.roomId;
  const room = await roomModel.findOne({ _id: roomID });

  if (!room)
    return res
      .status(404)
      .json({ message: "A room with this ID does not exist" });

  if (!name || !address || !city || !zip || !country || !checkin || !checkout) {
    return res.status(404).json({
      error: "Validation failed",
      fields: {
        name: name ? "Valid" : "Missing field name",
        name: address ? "Valid" : "Missing field address",
        name: city ? "Valid" : "Missing field city",
        name: zip ? "Valid" : "Missing field zip",
        name: country ? "Valid" : "Missing field country",
        name: checkin ? "Valid" : "Missing field checkin",
        name: checkout ? "Valid" : "Missing field checkout",
      },
    });
  }

  const code = generateReservationCode();

  const reservation = {
    code: code,
    name: name,
    created_at: new Date(),
    reservation_information: {
      checkin: checkin,
      checkout: checkout,
      room: {
        room_id: room._id,
        number: room.number,
      },
    },
  };

  room.reservations.push(reservation);

  try {
    await room.save();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal error" });
  }

  return res.status(201).json(reservation);
});

router.post("/rooms/reservations", async (req, res) => {
  const { code, name } = req.body;

  if (!code || !name) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const reservations = await roomModel
      .find({
        "reservations.code": code,
        "reservations.name": name,
      })
      .sort({
        "reservations.reservation_information.checkin": 1,
      });

    if (!reservations || reservations.length === 0) {
      return res.status(401).json({ error: "No matching reservations found" });
    }

    const formattedReservations = reservations.map((reservation) => ({
      id: reservation.reservations[0]._id,
      code: reservation.reservations[0].code,
      name: reservation.reservations[0].name,
      created_at: reservation.reservations[0].created_at,
      reservation_information: {
        checkin: reservation.reservations[0].reservation_information[0].checkin,
        checkout:
          reservation.reservations[0].reservation_information[0].checkout,
        room: reservation.reservations[0].reservation_information[0].room,
      },
    }));

    return res.status(200).json({ reservations: formattedReservations });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/rooms/reservations/:reservationId/cancel", async (req, res) => {
  const { code, name } = req.body;
  const reservationId = req.params.reservationId;

  if (!code || !name) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const reservation = await roomModel.findOne({
      "reservations._id": reservationId,
      "reservations.code": code,
      "reservations.name": name,
    });

    if (!reservation) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const reservationIndex = reservation.reservations.findIndex(
      (r) => r._id.toString() === reservationId
    );

    if (reservationIndex === -1) {
      return res
        .status(404)
        .json({ error: "A reservation with this ID does not exist" });
    }

    reservation.reservations.splice(reservationIndex, 1);

    await reservation.save();

    return res.status(204).json({ message: "success" });
  } catch (error) {
    console.error("Error canceling reservation:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
