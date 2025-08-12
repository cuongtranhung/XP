import React, { useState, useEffect } from 'react';
import Avatar from '../components/common/Avatar';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

const AvatarTest: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Login
        const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'cuongtranhung@gmail.com',
            password: '@Abcd6789'
          })
        });

        const loginData = await loginResponse.json();
        const token = loginData.data?.token || loginData.token;

        // Get users
        const usersResponse = await fetch('http://localhost:5000/api/user-management/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const usersData = await usersResponse.json();
        setUsers(usersData.data || []);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  if (loading) {
    return <div className="p-8">Loading users...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Avatar Test Page</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center space-x-4">
              <Avatar
                src={user.avatar_url}
                name={user.full_name}
                size="lg"
                alt={`Avatar của ${user.full_name}`}
              />
              <div>
                <h3 className="font-semibold">{user.full_name}</h3>
                <p className="text-gray-600 text-sm">{user.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Avatar: {user.avatar_url ? (
                    <span className="text-green-600">
                      ✅ Has Data ({user.avatar_url.length} chars)
                    </span>
                  ) : (
                    <span className="text-red-600">❌ No Data</span>
                  )}
                </p>
              </div>
            </div>
            
            {user.avatar_url && (
              <div className="mt-4 text-xs">
                <p className="text-gray-500">Avatar URL Preview:</p>
                <p className="font-mono bg-gray-100 p-2 rounded text-xs break-all">
                  {user.avatar_url.substring(0, 100)}...
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Avatar Size Test</h2>
        <div className="flex items-center space-x-4">
          {users[0] && (
            <>
              <div className="text-center">
                <Avatar src={users[0].avatar_url} name={users[0].full_name} size="sm" />
                <p className="text-xs mt-1">Small</p>
              </div>
              <div className="text-center">
                <Avatar src={users[0].avatar_url} name={users[0].full_name} size="md" />
                <p className="text-xs mt-1">Medium</p>
              </div>
              <div className="text-center">
                <Avatar src={users[0].avatar_url} name={users[0].full_name} size="lg" />
                <p className="text-xs mt-1">Large</p>
              </div>
              <div className="text-center">
                <Avatar src={users[0].avatar_url} name={users[0].full_name} size="xl" />
                <p className="text-xs mt-1">XL</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarTest;