# Odoo Backend Setup for Inventory Scanner

## Server Configuration

**Base URL:** `https://t.shajgoj.store`

## Required Odoo Configuration

### 1. CORS Configuration
Your Odoo server needs to allow CORS requests from your React app domain. Add this to your Odoo configuration:

```ini
# In odoo.conf
[options]
# Allow CORS for your React app
cors = *
# Or specifically for your domain:
# cors = https://your-react-app-domain.com
```

### 2. Inventory App Module
Ensure the inventory app module is installed and configured with these endpoints:

#### Authentication Endpoints
- `POST /inventory_app/login`
- `POST /inventory_app/logout` 
- `POST /inventory_app/refresh_token`

#### Core Business Endpoints
- `POST /inventory_app/get_lot_info`
- `POST /inventory_app/create_submission`
- `POST /inventory_app/update_submission`
- `POST /inventory_app/get_submissions`

### 3. User Permissions
Ensure users have proper permissions for:
- Inventory management
- Lot/serial number access
- Submission creation/modification
- Project access

## API Testing

### Test Connection
Use the "Test Connection" button on the login screen to verify:
1. **Basic Connection** - Tests if the Odoo server is reachable
2. **Login Endpoint** - Tests if the inventory app endpoints are accessible

### Expected Responses

#### Successful Login Response
```json
{
  "success": true,
  "api_token": "your_token_here",
  "sale_person_info": {
    "id": 1,
    "name": "User Name",
    "mobile_phone": "123-456-7890",
    "store_location": 1,
    "store_location_name": "Main Store"
  },
  "running_project": {
    "id": 1,
    "name": "Inventory Project",
    "location_id": 1,
    "location_name": "Main Warehouse",
    "start_date": "2024-01-01"
  },
  "available_racks": [
    {
      "id": 1,
      "name": "A-15",
      "location_id": 1,
      "location_name": "Main Warehouse",
      "note": "Rack A-15"
    }
  ]
}
```

#### Failed Login Response
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

## Troubleshooting

### Common Issues

#### 1. CORS Errors
**Error:** `Access to fetch at 'https://t.shajgoj.store' from origin 'http://localhost:3000' has been blocked by CORS policy`

**Solution:** Configure CORS in Odoo server settings

#### 2. 404 Endpoint Not Found
**Error:** `404 Not Found` on `/inventory_app/login`

**Solution:** Ensure inventory app module is installed and endpoints are properly configured

#### 3. Network Timeout
**Error:** `Network Error` or timeout

**Solution:** 
- Check if server is accessible
- Verify SSL certificate is valid
- Check firewall settings

#### 4. Authentication Failures
**Error:** `Invalid credentials` or `Authentication failed`

**Solution:**
- Verify mobile phone format matches expected format
- Check PIN is correct
- Ensure user exists in Odoo system

### Debug Mode
Set `REACT_APP_DEBUG=true` in `.env` for additional logging:

```bash
# .env
REACT_APP_DEBUG=true
```

## Production Deployment

### Environment Variables
```bash
# Production .env
REACT_APP_API_BASE_URL=https://t.shajgoj.store
REACT_APP_DEBUG=false
REACT_APP_CACHE_DURATION=3600000
```

### Security Considerations
1. **HTTPS Only** - Ensure all communication uses HTTPS
2. **Token Security** - API tokens are stored securely in IndexedDB
3. **Auto-logout** - Tokens expire and refresh automatically
4. **CORS Restrictions** - Configure CORS to only allow your app domain

### Performance Optimization
1. **Caching** - Lot info cached for 1 hour by default
2. **Offline Support** - Submissions queued when offline
3. **Auto-sync** - Background sync every 5 minutes
4. **Token Refresh** - Automatic token refresh before expiration

## Support

For issues with:
- **Odoo Configuration:** Contact your Odoo administrator
- **API Endpoints:** Check inventory app module documentation
- **React App:** Check browser console for detailed error messages
- **Network Issues:** Use connection test tool in login screen
