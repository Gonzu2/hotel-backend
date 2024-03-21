const mongoose = require("mongoose");

const reservedRoomSchema = new mongoose.Schema({
  room_id: String,
  number: Number,
});
const reservationInformationSchema = new mongoose.Schema({
  checkin: Date,
  checkout: Date,
  room: [reservedRoomSchema],
});
const reservationSchema = new mongoose.Schema({
  code: String,
  name: String,
  created_at: Date,
  reservation_information: [reservationInformationSchema],
});

const roomSchema = new mongoose.Schema({
  number: String,
  capacity: String,
  floor: String,
  room_image: String,
  price: String,
  wifi: Boolean,
  parking: Boolean,
  breakfast: Boolean,
  reservations: [reservationSchema],
});

const Room = mongoose.model("hotel", roomSchema, "hotel");
module.exports = Room;
