import React, { useRef, useState, useContext } from 'react'; // 1. Added useContext
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api/axios'; // Your configured axios instance
import { SyncContext } from '../context/SyncContext'; // 2. Import SyncContext
import { addToQueue } from '../api/offlineQueue';     // 3. Import queue utility

// Validation rules for creating a repair
const RepairSchema = Yup.object().shape({
  completion_date: Yup.date().required('Completion date is required'),
  location: Yup.string().required('Location is required'),
  description_of_work: Yup.string().required('Description is required'),
  materials_used: Yup.string(),
});

const RepairForm = ({ incidentId = null, userRole = 'technician' }) => {
  const sigCanvas = useRef({});
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [createdRepairId, setCreatedRepairId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [offlineRepairData, setOfflineRepairData] = useState(null); // Store repair data for offline certification
  
  // 4. Extract offline states from context
  const { isOnline, refreshQueueCount } = useContext(SyncContext);

  // Helper function to handle photo upload
  const uploadPhoto = async (repairId, photo) => {
    const formData = new FormData();
    formData.append('file', photo);
    formData.append('content_type', 'repair');
    formData.append('object_id', repairId);
    
    await api.post('/api/attachments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  };

  // 5. Updated offline-capable repair submission handler
  const handleCreateRepair = async (values, { setSubmitting, resetForm }) => {
    setStatusMsg({ type: 'info', message: 'Processing repair submission...' });
    
    try {
      const payload = { ...values, incident: incidentId };
      
      if (isOnline) {
        // Online flow - submit directly to API
        const repairRes = await api.post('/api/repairs/', payload);
        const newRepairId = repairRes.data.id;
        
        // Upload photo if attached
        if (photoFile) {
          await uploadPhoto(newRepairId, photoFile);
        }

        setStatusMsg({ 
          type: 'success', 
          message: 'Repair submitted successfully! Waiting for supervisor certification.' 
        });
        setCreatedRepairId(newRepairId);
        resetForm();
        setPhotoFile(null);
      } else {
        // Offline flow - force error to trigger offline handling
        throw new Error('Network offline');
      }
    } catch (error) {
      // Check if we're offline or if it's a network error
      if (!navigator.onLine || 
          error.message === 'Network Error' || 
          error.message === 'Network offline' ||
          error.code === 'ERR_NETWORK') {
        
        // Save repair data to queue
        const payload = { ...values, incident: incidentId };
        
        // Store in queue with special handling for photo
        const queueData = {
          ...payload,
          _offlinePhoto: photoFile ? {
            name: photoFile.name,
            type: photoFile.type,
            size: photoFile.size,
            // Convert photo to base64 for storage in IndexedDB
            data: await convertFileToBase64(photoFile)
          } : null
        };
        
        await addToQueue('/api/repairs/', queueData, 'POST', {
          isRepair: true,
          hasPhoto: !!photoFile
        });
        
        await refreshQueueCount(); // Update the UI counter
        
        // Store data for potential offline certification
        setOfflineRepairData({
          values: payload,
          photo: photoFile,
          timestamp: new Date().toISOString()
        });
        
        setStatusMsg({ 
          type: 'info', 
          message: 'Repair saved offline. It will sync automatically when connection is restored. ' +
                  (userRole === 'supervisor' ? 'You can still add your signature now.' : '')
        });
        
        // Only reset if we're not a supervisor who might need to sign
        if (userRole !== 'supervisor') {
          resetForm();
          setPhotoFile(null);
        }
      } else {
        // Actual API error (validation, server error, etc.)
        setStatusMsg({ 
          type: 'error', 
          message: error.response?.data?.detail || error.message || 'Failed to submit repair log. Please try again.' 
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Updated offline-capable certification handler
  const handleCertify = async () => {
    if (sigCanvas.current.isEmpty()) {
      setStatusMsg({ type: 'error', message: 'Please provide a signature to certify.' });
      return;
    }

    setStatusMsg({ type: 'info', message: 'Processing certification...' });
    
    // Convert signature to blob
    const signatureBlob = await new Promise((resolve) => {
      sigCanvas.current.getTrimmedCanvas().toBlob(resolve, 'image/png');
    });

    try {
      if (isOnline && createdRepairId) {
        // Online certification
        const formData = new FormData();
        formData.append('supervisor_signature', signatureBlob, 'signature.png');

        await api.patch(`/api/repairs/${createdRepairId}/certify/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        setStatusMsg({ type: 'success', message: 'Repair successfully certified and signed!' });
        sigCanvas.current.clear();
        setCreatedRepairId(null);
        
      } else if (!isOnline && offlineRepairData) {
        // Offline certification - store signature with the repair data
        const signatureBase64 = await convertBlobToBase64(signatureBlob);
        
        // Add certification data to queue
        const certificationData = {
          repairData: offlineRepairData.values,
          signature: signatureBase64,
          photo: offlineRepairData.photo ? {
            name: offlineRepairData.photo.name,
            type: offlineRepairData.photo.type,
            data: await convertFileToBase64(offlineRepairData.photo)
          } : null,
          certifiedAt: new Date().toISOString(),
          certifiedBy: 'supervisor' // This would come from auth context in real app
        };
        
        await addToQueue('/api/repairs/offline-certify/', certificationData, 'POST', {
          isCertification: true
        });
        
        await refreshQueueCount();
        
        setStatusMsg({ 
          type: 'info', 
          message: 'Certification saved offline. It will sync when connection is restored.' 
        });
        
        sigCanvas.current.clear();
        setOfflineRepairData(null);
      } else {
        setStatusMsg({ 
          type: 'error', 
          message: 'Unable to certify. Please ensure you are online or have submitted a repair.' 
        });
      }
    } catch (err) {
      setStatusMsg({ 
        type: 'error', 
        message: 'Certification failed: ' + (err.response?.data?.error || err.message) 
      });
    }
  };

  // Helper function to convert File to Base64
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Helper function to convert Blob to Base64
  const convertBlobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="form-section active">
      <h2 style={{ color: '#1a6fb0', marginBottom: '25px', paddingBottom: '15px', borderBottom: '2px solid #e0f0fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className="fas fa-tools"></i> Repairs Completion Certificate
      </h2>
      
      {/* Offline indicator */}
      {!isOnline && (
        <div style={{
          padding: '10px', 
          marginBottom: '20px', 
          borderRadius: '6px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          border: '1px solid #ffeeba',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fas fa-wifi-slash"></i>
          <span>
            You are currently offline. Repairs will be saved locally and synced when connection is restored.
            {userRole === 'supervisor' && ' Signatures can still be captured and will sync later.'}
          </span>
        </div>
      )}
      
      {/* Status Messages */}
      {statusMsg.message && (
        <div style={{
          padding: '15px', 
          marginBottom: '20px', 
          borderRadius: '6px',
          backgroundColor: statusMsg.type === 'success' ? '#d1fae5' : 
                         statusMsg.type === 'error' ? '#fee2e2' : '#e8f4fc',
          color: statusMsg.type === 'success' ? '#065f46' : 
                 statusMsg.type === 'error' ? '#991b1b' : '#1a6fb0'
        }}>
          <i className={`fas ${
            statusMsg.type === 'success' ? 'fa-check-circle' : 
            statusMsg.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
          }`} style={{ marginRight: '8px' }}></i>
          {statusMsg.message}
        </div>
      )}

      <Formik
        initialValues={{
          completion_date: new Date().toISOString().split('T')[0],
          location: '',
          description_of_work: '',
          materials_used: '',
        }}
        validationSchema={RepairSchema}
        onSubmit={handleCreateRepair}
      >
        {({ isSubmitting }) => (
          <Form>
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Date of Completion</label>
                <Field 
                  type="date" 
                  name="completion_date" 
                  className="form-control"
                  style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                />
                <ErrorMessage name="completion_date" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location</label>
                <Field 
                  type="text" 
                  name="location" 
                  placeholder="Repair location details" 
                  className="form-control"
                  style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                />
                <ErrorMessage name="location" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Description of Repairs</label>
              <Field 
                as="textarea" 
                name="description_of_work" 
                placeholder="Scope of work performed" 
                className="form-control"
                style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '80px' }}
              />
              <ErrorMessage name="description_of_work" component="div" style={{ color: '#e11d48', fontSize: '0.85rem', marginTop: '5px' }} />
            </div>

            <div className="form-group" style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Materials Used</label>
              <Field 
                as="textarea" 
                name="materials_used" 
                placeholder="List materials used..." 
                className="form-control"
                style={{ width: '100%', padding: '12px', border: '1px solid #d1e5f1', borderRadius: '6px', minHeight: '60px' }}
              />
            </div>

            {/* Photo Attachment Input */}
            <div className="form-group" style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                <i className="fas fa-camera" style={{ marginRight: '8px' }}></i> Attach Evidence Photo
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setPhotoFile(e.currentTarget.files[0])} 
                className="form-control"
                style={{ width: '100%', padding: '8px', border: '1px solid #d1e5f1', borderRadius: '6px' }}
                disabled={!isOnline && userRole === 'supervisor' && offlineRepairData} // Disable if offline and already have pending repair
              />
              {photoFile && (
                <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#065f46' }}>
                  <i className="fas fa-check-circle"></i> Selected: {photoFile.name}
                  {!isOnline && ' (will be saved offline)'}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="btn"
              style={{ 
                background: isOnline ? '#1a6fb0' : '#6c757d', 
                color: 'white', 
                border: 'none', 
                padding: '12px 25px', 
                borderRadius: '6px', 
                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                fontSize: '15px', 
                fontWeight: '600', 
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'background 0.3s ease'
              }}
            >
              <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-save'}`} style={{ marginRight: '8px' }}></i> 
              {isSubmitting 
                ? 'Processing...' 
                : isOnline 
                  ? 'Submit Repair Report' 
                  : 'Save Repair Offline'
              }
            </button>
          </Form>
        )}
      </Formik>

      {/* Signature & Certification Area - Visible if repair is created/offline and user is supervisor */}
      {((createdRepairId || offlineRepairData) && userRole === 'supervisor') && (
        <div className="signature-area" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px dashed #d1e5f1' }}>
          <h3 style={{ color: '#1a6fb0', marginBottom: '15px' }}>
            <i className="fas fa-signature"></i> Supervisor Certification
            {!isOnline && <span style={{ fontSize: '0.8rem', marginLeft: '10px', color: '#856404' }}>(Offline Mode)</span>}
          </h3>
          <div className="signature-box" style={{ width: '100%' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Supervisor Approval Signature</label>
            <div style={{ border: '1px solid #d1e5f1', borderRadius: '6px', background: '#f9fbfd', marginBottom: '10px', overflow: 'hidden' }}>
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{ width: 500, height: 150, className: 'sigCanvas', style: { width: '100%', height: '150px' } }} 
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                onClick={() => sigCanvas.current.clear()} 
                className="btn" 
                style={{ background: '#7f8c8d', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
              >
                <i className="fas fa-eraser"></i> Clear
              </button>
              <button 
                type="button" 
                onClick={handleCertify} 
                className="btn"
                style={{ 
                  background: isOnline ? '#1a6fb0' : '#6c757d', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  transition: 'background 0.3s ease'
                }}
              >
                <i className="fas fa-certificate"></i> 
                {isOnline ? ' Certify & Sign' : ' Save Signature Offline'}
              </button>
              {offlineRepairData && (
                <div style={{ fontSize: '0.9rem', color: '#856404', padding: '10px' }}>
                  <i className="fas fa-info-circle"></i> Pending repair will be synced with signature
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepairForm;