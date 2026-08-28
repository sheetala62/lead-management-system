const SERVICES   = ['Website Development', 'Web Application', 'Mobile Application', 'E-Commerce', 'SEO', 'Digital Marketing', 'Other'];
const SOURCES    = ['Website', 'WhatsApp', 'Referral', 'LinkedIn', 'Google', 'Facebook', 'Other'];
const STATUSES   = ['New', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const FOLLOWUP_TYPES = ['Call', 'Email', 'WhatsApp', 'Meeting', 'Other'];

const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\d{10}$/;

function validateLeadPayload(body, { partial = false } = {}) {
  const errors = {};
  const req = (field) => {
    if (!partial && (body[field] === undefined || body[field] === null || String(body[field]).trim() === '')) {
      errors[field] = `${field} is required`;
    }
  };

  req('lead_name');
  req('company_name');
  req('mobile');
  req('email');
  req('service_required');
  req('lead_source');
  req('assigned_to');
  req('lead_status');

  if (body.email        && !EMAIL_RE.test(body.email))   errors.email  = 'Invalid email format';
  if (body.mobile       && !MOBILE_RE.test(body.mobile)) errors.mobile = 'Mobile number must contain exactly 10 digits';

  if (body.service_required && !SERVICES.includes(body.service_required))
    errors.service_required = 'Invalid service value';
  if (body.lead_source && !SOURCES.includes(body.lead_source))
    errors.lead_source = 'Invalid lead source value';
  if (body.lead_status && !STATUSES.includes(body.lead_status))
    errors.lead_status = 'Invalid lead status value';
  if (body.priority && !PRIORITIES.includes(body.priority))
    errors.priority = 'Invalid priority value';

  if (body.estimated_value !== undefined && body.estimated_value !== null && body.estimated_value !== '') {
    if (isNaN(Number(body.estimated_value)) || Number(body.estimated_value) < 0)
      errors.estimated_value = 'Estimated value must be a non-negative number';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function validateFollowupPayload(body) {
  const errors = {};
  if (!body.followup_date) errors.followup_date = 'followup_date is required';
  if (!body.followup_type) errors.followup_type = 'followup_type is required';
  if (body.followup_type && !FOLLOWUP_TYPES.includes(body.followup_type))
    errors.followup_type = 'Invalid follow-up type';
  return { valid: Object.keys(errors).length === 0, errors };
}

module.exports = { SERVICES, SOURCES, STATUSES, PRIORITIES, FOLLOWUP_TYPES, validateLeadPayload, validateFollowupPayload };
