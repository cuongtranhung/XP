// Direct API test to see the actual response structure
import fetch from 'node-fetch';

const testAPI = async () => {
  try {
    // Get token from a test login first
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'cuongtranhung@gmail.com',
        password: '@Abcd6789'
      })
    });

    if (!loginResponse.ok) {
      console.error('Login failed:', loginResponse.status);
      return;
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('Token obtained successfully');

    // Now get the form data
    const formId = 'e5b13cb9-56b6-4ae4-bdfd-533370a5c049';
    const formResponse = await fetch(`http://localhost:5000/api/forms/${formId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!formResponse.ok) {
      console.error('Form fetch failed:', formResponse.status);
      return;
    }

    const formData = await formResponse.json();
    
    console.log('\n=== API Response Structure ===');
    console.log('Top level keys:', Object.keys(formData));
    console.log('Success:', formData.success);
    
    if (formData.data) {
      console.log('\n=== Form Data ===');
      console.log('Form name:', formData.data.name);
      console.log('Form ID:', formData.data.id);
      console.log('Fields count:', formData.data.fields?.length);
      
      if (formData.data.fields && formData.data.fields.length > 0) {
        console.log('\n=== First Field ===');
        console.log(JSON.stringify(formData.data.fields[0], null, 2));
      }
    } else {
      console.log('\n=== Direct Form Data (no wrapper) ===');
      console.log('Form name:', formData.name);
      console.log('Form ID:', formData.id);
      console.log('Fields count:', formData.fields?.length);
    }

    console.log('\n=== Full Response (first 500 chars) ===');
    console.log(JSON.stringify(formData, null, 2).substring(0, 500));

  } catch (error) {
    console.error('Error:', error);
  }
};

testAPI();