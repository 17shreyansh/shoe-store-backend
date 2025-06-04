const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    // Removed 'required: true' because it's generated in pre-save middleware
    // The pre-save hook will ensure it's always set for new documents.
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Order Issue', 'Payment Problem', 'Product Query', 'Account Issue', 'Technical Support', 'General Inquiry'],
    default: 'General Inquiry'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    isAdminReply: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  resolution: {
    type: String,
    trim: true,
    maxlength: [1000, 'Resolution cannot exceed 1000 characters']
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: [500, 'Feedback cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Pre-save middleware to generate ticket ID
ticketSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    // Ensure the generated ID is unique even if countDocuments is slightly off
    let newTicketId;
    let isUnique = false;
    let attempt = 0;
    while (!isUnique && attempt < 5) { // Try a few times to ensure uniqueness
      newTicketId = `TKT-${String(count + 1 + attempt).padStart(6, '0')}`;
      const existingTicket = await this.constructor.findOne({ ticketId: newTicketId });
      if (!existingTicket) {
        isUnique = true;
      }
      attempt++;
    }
    if (!isUnique) {
        // Fallback if after several attempts it's still not unique (highly unlikely)
        newTicketId = `TKT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    this.ticketId = newTicketId;
  }
  next();
});

// Indexes for better performance (removed redundant ticketId index in previous fix)
ticketSchema.index({ user: 1, status: 1 });
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ createdAt: -1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
