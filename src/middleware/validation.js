import Joi from 'joi';

// ===================== SCHEMAS =====================

// ===== AUTH SCHEMAS =====
export const registerSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Name must be at least 3 characters',
      'string.max': 'Name must be less than 100 characters',
      'any.required': 'Name is required'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required'
    }),
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number must be 10-15 digits'
    }),
  role: Joi.string()
    .valid('admin', 'affiliate')
    .default('affiliate')
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required'
    })
});

export const logoutSchema = Joi.object({
  refreshToken: Joi.string()
    .optional()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  newPassword: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'New password must be at least 6 characters',
      'any.required': 'New password is required'
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Confirm password is required'
    })
});

// ===== USER SCHEMAS =====
export const updateProfileSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(100)
    .optional(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .optional()
    .allow(null, ''),
  bankName: Joi.string()
    .max(100)
    .optional()
    .allow(null, ''),
  accountNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .optional()
    .allow(null, ''),
  accountName: Joi.string()
    .max(100)
    .optional()
    .allow(null, '')
});

export const userEmailSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
});

export const userIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid user ID format',
      'any.required': 'User ID is required'
    })
});

// ===== PROGRAM SCHEMAS =====
export const createProgramSchema = Joi.object({
  title: Joi.string()
    .min(5)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title must be at least 5 characters',
      'string.max': 'Title must be less than 200 characters',
      'any.required': 'Title is required'
    }),
  description: Joi.string()
    .optional()
    .allow(null, ''),
  price: Joi.number()
    .positive()
    .required()
    .messages({
      'number.positive': 'Price must be greater than 0',
      'any.required': 'Price is required'
    }),
  monthlyFee: Joi.number()
    .positive()
    .required()
    .messages({
      'number.positive': 'Monthly fee must be greater than 0',
      'any.required': 'Monthly fee is required'
    }),
  durationMonths: Joi.number()
    .integer()
    .min(1)
    .max(12)
    .required()
    .messages({
      'number.min': 'Duration must be at least 1 month',
      'number.max': 'Duration cannot exceed 12 months',
      'any.required': 'Duration is required'
    }),
  type: Joi.string()
    .valid('internship', 'siwes')
    .default('internship'),
  category: Joi.string()
    .optional()
    .allow(null, ''),
  affiliateCommission: Joi.number()
    .positive()
    .optional()
});

export const updateProgramSchema = Joi.object({
  title: Joi.string()
    .min(5)
    .max(200)
    .optional(),
  description: Joi.string()
    .optional()
    .allow(null, ''),
  price: Joi.number()
    .positive()
    .optional(),
  monthlyFee: Joi.number()
    .positive()
    .optional(),
  durationMonths: Joi.number()
    .integer()
    .min(1)
    .max(12)
    .optional(),
  type: Joi.string()
    .valid('internship', 'siwes')
    .optional(),
  category: Joi.string()
    .optional()
    .allow(null, ''),
  isActive: Joi.boolean()
    .optional(),
  affiliateCommission: Joi.number()
    .positive()
    .optional()
});

export const programIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid program ID format',
      'any.required': 'Program ID is required'
    })
});

// ===== REGISTRATION SCHEMAS =====
export const createRegistrationSchema = Joi.object({
  programId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid program ID format',
      'any.required': 'Program ID is required'
    }),
  studentName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Student name must be at least 2 characters',
      'string.max': 'Student name must be less than 100 characters',
      'any.required': 'Student name is required'
    }),
  studentPhone: Joi.string()
    .pattern(/^[0-9]{10,15}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be 10-15 digits',
      'any.required': 'Student phone is required'
    }),
  studentEmail: Joi.string()
    .email()
    .optional()
    .allow(null, ''),
  course: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Course must be at least 2 characters',
      'string.max': 'Course must be less than 100 characters',
      'any.required': 'Course is required'
    }),
  department: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Department must be at least 2 characters',
      'string.max': 'Department must be less than 100 characters',
      'any.required': 'Department is required'
    }),
  regNumber: Joi.string()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.min': 'Registration number must be at least 3 characters',
      'string.max': 'Registration number must be less than 50 characters',
      'any.required': 'Registration number is required'
    }),
  hodName: Joi.string()
    .max(100)
    .optional()
    .allow(null, ''),
  supervisorName: Joi.string()
    .max(100)
    .optional()
    .allow(null, '')
});

export const updateRegistrationStatusSchema = Joi.object({
  reason: Joi.string()
    .max(500)
    .optional()
    .allow(null, '')
});

export const registrationIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid registration ID format',
      'any.required': 'Registration ID is required'
    })
});

// ===== PAYMENT SCHEMAS =====
export const initializePaymentSchema = Joi.object({
  registrationId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid registration ID format',
      'any.required': 'Registration ID is required'
    }),
  paidUserEmail: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Paid user email is required'
    }),
  amount: Joi.number()
    .positive()
    .required()
    .messages({
      'number.positive': 'Amount must be greater than 0',
      'any.required': 'Amount is required'
    })
});

export const referenceSchema = Joi.object({
  reference: Joi.string()
    .required()
    .messages({
      'any.required': 'Reference is required'
    })
});

// ===== PAYOUT SCHEMAS =====
export const createPayoutSchema = Joi.object({
  amount: Joi.number()
    .positive()
    .required()
    .messages({
      'number.positive': 'Amount must be greater than 0',
      'any.required': 'Amount is required'
    }),
  bankName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Bank name must be at least 2 characters',
      'string.max': 'Bank name must be less than 100 characters',
      'any.required': 'Bank name is required'
    }),
  accountNumber: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Account number must be 10 digits',
      'any.required': 'Account number is required'
    }),
  accountName: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Account name must be at least 2 characters',
      'string.max': 'Account name must be less than 100 characters',
      'any.required': 'Account name is required'
    }),
  note: Joi.string()
    .max(500)
    .optional()
    .allow(null, '')
});

export const payoutIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.uuid': 'Invalid payout ID format',
      'any.required': 'Payout ID is required'
    })
});

export const approvePayoutSchema = Joi.object({
  // No additional fields needed, but keep for extensibility
});

export const rejectPayoutSchema = Joi.object({
  reason: Joi.string()
    .max(500)
    .optional()
    .allow(null, '')
});

// ===== COMMISSION SCHEMAS =====
export const commissionRateSchema = Joi.object({
  commissionRate: Joi.number()
    .min(1)
    .max(50)
    .required()
    .messages({
      'number.min': 'Commission rate must be at least 1%',
      'number.max': 'Commission rate cannot exceed 50%',
      'any.required': 'Commission rate is required'
    })
});

// ===== PAGINATION SCHEMAS =====
export const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),
  status: Joi.string()
    .optional()
});

// ===================== VALIDATION MIDDLEWARE =====================

export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace req.body with validated data
    req.body = value;
    next();
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: errors
      });
    }

    req.params = value;
    next();
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errors
      });
    }

    req.query = value;
    next();
  };
};

// ===================== EXPORTS =====================
export default {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  changePasswordSchema,
  updateProfileSchema,
  userEmailSchema,
  userIdSchema,
  createProgramSchema,
  updateProgramSchema,
  programIdSchema,
  createRegistrationSchema,
  updateRegistrationStatusSchema,
  registrationIdSchema,
  initializePaymentSchema,
  referenceSchema,
  createPayoutSchema,
  payoutIdSchema,
  approvePayoutSchema,
  rejectPayoutSchema,
  commissionRateSchema,
  paginationSchema,
  validate,
  validateParams,
  validateQuery
};