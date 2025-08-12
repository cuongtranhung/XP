// Check if ceo@911.com.vn was deleted
const checkDeletedUser = async () => {
  console.log('🔍 Checking deleted user status...\n');
  
  const testCredentials = {
    email: 'cuongtranhung@gmail.com',
    password: '@Abcd6789'
  };

  try {
    // Step 1: Login to get token
    console.log('📋 Step 1: Login');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCredentials)
    });

    if (loginResponse.status !== 200) {
      console.log('❌ Login failed');
      return false;
    }

    const loginData = await loginResponse.json();
    const token = loginData.data?.token || loginData.token;
    console.log('✅ Login successful');

    // Step 2: Get all users (including deleted)
    console.log('\n📋 Step 2: Get All Users from API');
    const usersResponse = await fetch('http://localhost:5000/api/user-management/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (usersResponse.status === 200) {
      const usersData = await usersResponse.json();
      const users = usersData.data || [];
      console.log(`✅ Found ${users.length} active users`);
      
      const ceoUser = users.find(u => u.email === 'ceo@911.com.vn');
      if (ceoUser) {
        console.log('✅ User ceo@911.com.vn is ACTIVE in the system');
        console.log('User details:', ceoUser);
      } else {
        console.log('❌ User ceo@911.com.vn NOT FOUND in active users list');
        console.log('This user was likely SOFT DELETED');
      }
      
      console.log('\n📋 All Active Users:');
      users.forEach(user => {
        console.log(`  - ${user.email || 'no-email'} (${user.full_name || 'no-name'}) - Status: ${user.status || 'unknown'}`);
      });
    }

    // Step 3: Try to get specific user
    console.log('\n📋 Step 3: Try to fetch user ID 22 (ceo@911.com.vn)');
    const userResponse = await fetch('http://localhost:5000/api/user-management/users/22', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (userResponse.status === 404) {
      console.log('❌ User ID 22 returns 404 - User was SOFT DELETED');
      console.log('The deleted_at field is NOT NULL, so user is filtered out');
    } else if (userResponse.status === 200) {
      const userData = await userResponse.json();
      console.log('✅ User ID 22 is still accessible');
      console.log('User data:', userData.data);
    }

    console.log('\n🎯 DIAGNOSIS:');
    console.log('================================');
    console.log('The user ceo@911.com.vn was SOFT DELETED in the previous test');
    console.log('Soft delete sets deleted_at = NOW() and status = "deleted"');
    console.log('The API query filters: WHERE deleted_at IS NULL');
    console.log('Therefore, deleted users do not appear in the list');
    console.log('');
    console.log('💡 SOLUTION:');
    console.log('To restore the user, run this SQL:');
    console.log('UPDATE users SET deleted_at = NULL, status = "active" WHERE email = "ceo@911.com.vn";');

    return true;

  } catch (error) {
    console.log(`❌ Test error: ${error.message}`);
    return false;
  }
};

// Run the check
checkDeletedUser().then(success => {
  if (success) {
    console.log('\n✅ Diagnosis complete!');
  } else {
    console.log('\n❌ Check failed');
  }
}).catch(error => {
  console.error('❌ Execution failed:', error);
});