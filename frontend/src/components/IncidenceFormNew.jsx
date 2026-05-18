import React, { useState, useContext, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import api from '../api/axios';
import { SyncContext } from '../context/SyncContext';
import AuthContext from '../context/AuthContext';

// Enhanced Validation Schema (Section 4)
const IncidenceSchema = Yup.object().shape({
  reported_at: Yup.date().required('Date of incident is required'),
  category: Yup.string().required('Please select a category'),
  severity: Yup.string().required('Please select a severity level'),
  location_text: Yup.string().required('Location is required'),
  zone: Yup.string().required('Zone/Area is required'),
  reported_by_name: Yup.string().required('Reporter name is required'),
  reported_contact: Yup.string().required('Contact information is required'),
  description: Yup.string().required('Please describe the problem'),
  // Conditional fields
  sewer_line_reference: Yup.string().when('category', {
    is: 'blockage',
    then: Yup.string().required('Sewer line reference is required for blockage')
  }),
  spillage_public_area: Yup.string().when('category', {
    is: 'spillage',
    then: Yup.string().required('Please specify if spillage affected public area')
  }),
  other_category: Yup.string().when('category', {
    is: 'other',
    then: Yup.string().required('Please specify the category')
  })
});

const IncidenceForm = () => {
  const [submitStatus, setSubmitStatus] = useState({ type: '', message: '' });
  const [zones, setZones] = useState([]);
  const [relatedIncidents, setRelatedIncidents] = useState([]);
  const [incidentSearchQuery, setIncidentSearchQuery] = useState('');
  const [mapPreview, setMapPreview] = useState(null);
  const [photoList, setPhotoList] = useState([]);
  const [successIncident, setSuccessIncident] = useState(null);
  
  const { isOnline } = useContext(SyncContext);
  const { user } = useContext(AuthContext);

  // Fetch zones on mount
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await api.get('/api/zones/', { params: { is_active: true } });
        setZones(Array.isArray(response.data) ? response.data : response.data?.results || []);
      } catch (error) {
        console.error('Failed to fetch zones:', error);
      }
    };
    fetchZones();
  }, []);

  const initialValues = {
    reported_at: new Date().toISOString().slice(0, 16),
    category: 'blockage',
    severity: 'low',
    q1_spillage_public: false, // Q1: Spillage affecting public area?
    q2_multiple_properties: false, // Q2: Affecting multiple properties?
    is_reporter: false, // "Me" checkbox
    location_text: '',
    latitude: '',
    longitude: '',
    zone: '',
    reported_by_name: '',
    reported_contact: '',
    description: '',
    sewer_line_reference: '', // Conditional: for blockage
    spillage_public_area: '', // Conditional: for spillage (Yes/No)
    other_category: '', // Conditional: for other
    is_related_incident: false,
    related_incident_id: null,
    photos: [] // Multiple photos
  };

  // Calculate suggested severity based on guided questions
  const calculateSuggestedSeverity = (q1, q2) => {
    if (q1 && q2) return 'critical';
    if (q1) return 'high';
    if (q2) return 'high';
    return 'low';
  };

  // Map severity to color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#DC2626'; // red
      case 'high': return '#EA580C'; // orange
      case 'medium': return '#CA8A04'; // yellow
      default: return '#16A34A'; // green
    }
  };

  // Hardware Geolocation Capture with reverse geocoding
  const captureLocation = (setFieldValue) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lng = position.coords.longitude.toFixed(6);
          setFieldValue('latitude', lat);
          setFieldValue('longitude', lng);

          // Show map preview
          setMapPreview({ lat, lng });

          try {
            // Reverse geocoding via Nominatim
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            );
            const data = await response.json();
            
            // Extract relevant place name
            const placeName = data.address?.amenity || data.address?.road || 
                            data.address?.suburb || data.address?.town || 'Unknown Location';
            
            setFieldValue('location_text', `${lat}, ${lng} (near ${placeName})`);
          } catch (error) {
            setFieldValue('location_text', `${lat}, ${lng} (near [landmark])`);
          }
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setSubmitStatus({ 
              type: 'error', 
              message: 'Location access was denied. Please enable location access in your browser settings or type manually.' 
            });
          } else {
            setSubmitStatus({ 
              type: 'error', 
              message: 'Could not get GPS. Please type the location manually.' 
            });
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  // Search for related incidents
  const searchRelatedIncidents = async (query) => {
    setIncidentSearchQuery(query);
    if (!query || query.length < 2) {
      setRelatedIncidents([]);
      return;
    }

    try {
      const response = await api.get('/api/incidents/search/', { params: { location: query } });
      setRelatedIncidents(Array.isArray(response.data) ? response.data : response.data?.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = (event, values, setFieldValue) => {
    const files = Array.from(event.target.files);
    const newPhotos = files.slice(0, 5 - photoList.length).map(file => ({
      file,
      caption: '',
      preview: URL.createObjectURL(file)
    }));
    
    const updatedPhotos = [...photoList, ...newPhotos];
    setPhotoList(updatedPhotos);
    setFieldValue('photos', updatedPhotos);
  };

  // Remove photo
  const removePhoto = (index, setFieldValue) => {
    const updatedPhotos = photoList.filter((_, i) => i !== index);
    setPhotoList(updatedPhotos);
    setFieldValue('photos', updatedPhotos);
  };

  // Handle form submission
  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    setSubmitStatus({ type: '', message: '' });
    
    if (!isOnline) {
      setSubmitStatus({ 
        type: 'error', 
        message: 'You appear to be offline. This action will be queued and retried automatically.' 
      });
      return;
    }

    try {
      // Prepare payload
      const payload = {
        reported_at: values.reported_at,
        category: values.category,
        severity: values.severity,
        location_text: values.location_text,
        latitude: values.latitude || null,
        longitude: values.longitude || null,
        zone: values.zone,
        reported_by_name: values.reported_by_name,
        reported_contact: values.reported_contact,
        description: values.description,
        received_by: user.id,
        created_by: user.id,
        sewer_line_reference: values.sewer_line_reference || null,
        spillage_public_area: values.spillage_public_area || null,
        other_category: values.other_category || null,
        related_incident: values.related_incident_id || null,
        assignment_instructions: ''
      };

      // Create the incident
      const response = await api.post('/api/incidents/', payload);
      const incidentId = response.data.id;
      const incidentNumber = response.data.incident_number;

      // Upload photos if any
      if (photoList && photoList.length > 0) {
        for (const photo of photoList) {
          const formData = new FormData();
          formData.append('file', photo.file);
          formData.append('content_type', 'incident');
          formData.append('object_id', incidentId);
          formData.append('caption', photo.caption);

          try {
            await api.post('/api/attachments/', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (err) {
            console.error('Failed to upload photo:', err);
          }
        }
      }

      // Show success confirmation screen
      setSuccessIncident({
        reference: incidentNumber,
        category: values.category,
        severity: values.severity,
        location: values.location_text,
        submittedBy: user.full_name || user.username,
        submittedAt: new Date().toLocaleString()
      });

      setPhotoList([]);
    } catch (error) {
      setSubmitStatus({ 
        type: 'error', 
        message: error.response?.data?.detail || 'Failed to submit incident. Please try again.' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // If success screen shown, display confirmation
  if (successIncident) {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        <div style={{
          background: '#f0fdf4',
          border: '2px solid #16A34A',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <h2 style={{ color: '#166534', margin: '0 0 16px 0' }}>Incident Reported Successfully</h2>
          
          <div style={{ 
            background: 'white', 
            padding: '16px', 
            borderRadius: '8px', 
            textAlign: 'left',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            <p><strong>Reference:</strong> {successIncident.reference}</p>
            <p><strong>Category:</strong> {successIncident.category}</p>
            <p><strong>Priority:</strong> <span style={{
              background: getSeverityColor(successIncident.severity),
              color: 'white',
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>{successIncident.severity}</span></p>
            <p><strong>Location:</strong> {successIncident.location}</p>
            <p><strong>Submitted by:</strong> {successIncident.submittedBy}</p>
            <p><strong>Date/Time:</strong> {successIncident.submittedAt}</p>
          </div>

          {(successIncident.severity === 'critical' || successIncident.severity === 'high') && (
            <div style={{
              background: '#fef08a',
              border: '1px solid #ca8a04',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              color: '#7c2d12'
            }}>
              <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>
                ⚠ This is a {successIncident.severity.toUpperCase()} priority incident.
              </p>
              <p style={{ margin: 0 }}>Contact your supervisor immediately.</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                setSuccessIncident(null);
                window.location.href = '/incidence';
              }}
              style={{
                background: '#3B82F6',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Report Another Incident
            </button>
            <button
              onClick={() => window.location.href = '/dispatch'}
              style={{
                background: '#6B7280',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Go to My Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={IncidenceSchema}
      onSubmit={handleSubmit}
    >
      {({ values, setFieldValue, isSubmitting, errors, touched }) => (
        <Form style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2>Report Incident</h2>

          {submitStatus.message && (
            <div style={{
              background: submitStatus.type === 'error' ? '#fee2e2' : '#f0fdf4',
              color: submitStatus.type === 'error' ? '#991b1b' : '#166534',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              borderLeft: `4px solid ${submitStatus.type === 'error' ? '#dc2626' : '#16a34a'}`
            }}>
              {submitStatus.message}
            </div>
          )}

          {/* Date */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
              Date & Time of Incident *
            </label>
            <Field
              type="datetime-local"
              name="reported_at"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                minHeight: '44px'
              }}
            />
            <ErrorMessage name="reported_at" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
          </div>

          {/* Category */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
              Incident Category *
            </label>
            <Field
              as="select"
              name="category"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                minHeight: '44px'
              }}
            >
              <option value="blockage">Blockage</option>
              <option value="burst">Burst Pipe</option>
              <option value="spillage">Sewer Spillage</option>
              <option value="odor">Foul Odor</option>
              <option value="missing_cover">Missing Manhole Cover</option>
              <option value="illegal_connection">Illegal Connection</option>
              <option value="other">Other</option>
            </Field>
            <ErrorMessage name="category" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
          </div>

          {/* Conditional Fields by Category */}
          {values.category === 'blockage' && (
            <div style={{ marginBottom: '20px', background: '#f3f4f6', padding: '12px', borderRadius: '6px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Sewer Line Reference
              </label>
              <Field
                type="text"
                name="sewer_line_reference"
                placeholder="e.g., SL-104"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  minHeight: '44px'
                }}
              />
              <ErrorMessage name="sewer_line_reference" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
            </div>
          )}

          {values.category === 'spillage' && (
            <div style={{ marginBottom: '20px', background: '#f3f4f6', padding: '12px', borderRadius: '6px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                Has spillage reached a public area, road, or watercourse?
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="spillage_public_area"
                    value="yes"
                    onChange={() => setFieldValue('spillage_public_area', 'yes')}
                    checked={values.spillage_public_area === 'yes'}
                  />
                  Yes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="spillage_public_area"
                    value="no"
                    onChange={() => setFieldValue('spillage_public_area', 'no')}
                    checked={values.spillage_public_area === 'no'}
                  />
                  No
                </label>
              </div>
              <ErrorMessage name="spillage_public_area" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
            </div>
          )}

          {values.category === 'other' && (
            <div style={{ marginBottom: '20px', background: '#f3f4f6', padding: '12px', borderRadius: '6px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Specify Category
              </label>
              <Field
                type="text"
                name="other_category"
                placeholder="Please describe the incident type"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  minHeight: '44px'
                }}
              />
              <ErrorMessage name="other_category" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
            </div>
          )}

          {/* Guided Severity Selector */}
          <div style={{ marginBottom: '20px', background: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold' }}>Quick Priority Assessment</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>
                Q1: Is there active spillage or overflow affecting a public area, road, or watercourse?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFieldValue('q1_spillage_public', true)}
                  style={{
                    padding: '8px 16px',
                    background: values.q1_spillage_public ? '#3B82F6' : '#e5e7eb',
                    color: values.q1_spillage_public ? 'white' : '#1f2937',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFieldValue('q1_spillage_public', false)}
                  style={{
                    padding: '8px 16px',
                    background: !values.q1_spillage_public ? '#3B82F6' : '#e5e7eb',
                    color: !values.q1_spillage_public ? 'white' : '#1f2937',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  No
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600' }}>
                Q2: Is this affecting multiple properties or a key facility (school, hospital, market)?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setFieldValue('q2_multiple_properties', true)}
                  style={{
                    padding: '8px 16px',
                    background: values.q2_multiple_properties ? '#3B82F6' : '#e5e7eb',
                    color: values.q2_multiple_properties ? 'white' : '#1f2937',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFieldValue('q2_multiple_properties', false)}
                  style={{
                    padding: '8px 16px',
                    background: !values.q2_multiple_properties ? '#3B82F6' : '#e5e7eb',
                    color: !values.q2_multiple_properties ? 'white' : '#1f2937',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  No
                </button>
              </div>
            </div>

            {/* Suggested Severity */}
            <div style={{
              background: getSeverityColor(calculateSuggestedSeverity(values.q1_spillage_public, values.q2_multiple_properties)),
              color: 'white',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '12px',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              Suggested Priority: {calculateSuggestedSeverity(values.q1_spillage_public, values.q2_multiple_properties).toUpperCase()}
            </div>

            {/* Override Option */}
            <details style={{ fontSize: '13px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#3B82F6' }}>
                Does this not seem right? Override priority
              </summary>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #bfdbfe' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Select Priority Level
                </label>
                <Field
                  as="select"
                  name="severity"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    marginBottom: '12px'
                  }}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Field>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Reason for Override *
                </label>
                <Field
                  as="textarea"
                  name="override_reason"
                  placeholder="Explain why you're overriding the suggested priority"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    minHeight: '60px',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </details>
          </div>

          {/* "Me" Checkbox on Reported By */}
          <div style={{ marginBottom: '20px', background: '#f3f4f6', padding: '12px', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={values.is_reporter}
                onChange={(e) => {
                  setFieldValue('is_reporter', e.target.checked);
                  if (e.target.checked) {
                    setFieldValue('reported_by_name', user.full_name || user.username);
                    setFieldValue('reported_contact', user.phone_number || '');
                  } else {
                    setFieldValue('reported_by_name', '');
                    setFieldValue('reported_contact', '');
                  }
                }}
              />
              <span style={{ fontWeight: '600' }}>I am the reporter</span>
            </label>
          </div>

          {/* Reporter Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
                Reported By *
              </label>
              <Field
                type="text"
                name="reported_by_name"
                placeholder="Full name"
                readOnly={values.is_reporter}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${values.is_reporter ? '#d1d5db' : '#d1d5db'}`,
                  borderRadius: '6px',
                  minHeight: '44px',
                  background: values.is_reporter ? '#f3f4f6' : 'white'
                }}
              />
              <ErrorMessage name="reported_by_name" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
                Contact Information *
              </label>
              <Field
                type="text"
                name="reported_contact"
                placeholder="Phone or email"
                readOnly={values.is_reporter}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  minHeight: '44px',
                  background: values.is_reporter ? '#f3f4f6' : 'white'
                }}
              />
              <ErrorMessage name="reported_contact" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
            </div>
          </div>

          {/* Location with GPS */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
              Location Description *
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <Field
                type="text"
                name="location_text"
                placeholder="Landmark or address"
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  minHeight: '44px'
                }}
              />
              <button
                type="button"
                onClick={() => captureLocation(setFieldValue)}
                style={{
                  padding: '10px 16px',
                  background: '#1a6fb0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                📍 Get GPS
              </button>
            </div>
            {mapPreview && (
              <div style={{
                height: '100px',
                background: '#e5e7eb',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
                color: '#6B7280',
                fontSize: '12px'
              }}>
                📍 Map preview: {mapPreview.lat}, {mapPreview.lng}
              </div>
            )}
            <ErrorMessage name="location_text" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
          </div>

          {/* Zone */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
              Zone / Area *
            </label>
            <Field
              as="select"
              name="zone"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                minHeight: '44px'
              }}
            >
              <option value="">Select a zone</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </Field>
            <ErrorMessage name="zone" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
              Description *
            </label>
            <Field
              as="textarea"
              name="description"
              placeholder="Provide detailed description of the incident"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                minHeight: '100px',
                fontFamily: 'inherit'
              }}
            />
            <ErrorMessage name="description" component="div" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }} />
          </div>

          {/* Related Incident Linkage */}
          <div style={{ marginBottom: '20px', background: '#f3f4f6', padding: '12px', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={values.is_related_incident}
                onChange={(e) => {
                  setFieldValue('is_related_incident', e.target.checked);
                  if (!e.target.checked) {
                    setFieldValue('related_incident_id', null);
                  }
                }}
              />
              <span style={{ fontWeight: '600' }}>Is this related to a previous incident at this location?</span>
            </label>

            {values.is_related_incident && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                  Search previous incidents
                </label>
                <input
                  type="text"
                  placeholder="Search by location or reference number"
                  value={incidentSearchQuery}
                  onChange={(e) => searchRelatedIncidents(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    minHeight: '40px',
                    marginBottom: '8px'
                  }}
                />
                {relatedIncidents.length > 0 && (
                  <div style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'white'
                  }}>
                    {relatedIncidents.map(inc => (
                      <div
                        key={inc.id}
                        onClick={() => {
                          setFieldValue('related_incident_id', inc.id);
                          setShowIncidentSearch(false);
                        }}
                        style={{
                          padding: '10px',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          background: values.related_incident_id === inc.id ? '#dbeafe' : 'white'
                        }}
                      >
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>
                          {inc.incident_number} — {inc.category}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>
                          {inc.location_text} • {inc.date || 'Unknown date'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Photo Upload */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', color: '#6B7280' }}>
              Photographic Evidence (up to 5 photos)
            </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handlePhotoUpload(e, values, setFieldValue)}
              disabled={photoList.length >= 5}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px dashed #d1d5db',
                borderRadius: '6px',
                cursor: photoList.length >= 5 ? 'not-allowed' : 'pointer',
                opacity: photoList.length >= 5 ? 0.5 : 1
              }}
            />

            {/* Photo Previews */}
            {photoList.length > 0 && (
              <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                {photoList.map((photo, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <img
                      src={photo.preview}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Caption (optional)"
                      value={photo.caption}
                      onChange={(e) => {
                        const updated = [...photoList];
                        updated[index].caption = e.target.value;
                        setPhotoList(updated);
                      }}
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '11px',
                        marginTop: '4px',
                        marginBottom: '4px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index, setFieldValue)}
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              background: '#1a6fb0',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '16px',
              minHeight: '44px',
              opacity: isSubmitting ? 0.6 : 1
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Incident Report'}
          </button>
        </Form>
      )}
    </Formik>
  );
};

export default IncidenceForm;
