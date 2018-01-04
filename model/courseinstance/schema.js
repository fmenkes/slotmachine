const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const courseinstanceSchema = new Schema({
  course: {type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true},
  year: { type: Number, required: true },
  semester: { type: String, required: true},
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  exams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exam' }]
});


module.exports =  courseinstanceSchema;