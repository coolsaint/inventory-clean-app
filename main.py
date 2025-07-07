from odoo import http, _
from odoo.http import request
import json
import logging

_logger = logging.getLogger(__name__)

class InventoryBatchSubmissionController(http.Controller):
    
    @http.route('/inventory_app/login', type='json', auth='none', methods=['POST'], csrf=False)
    def login(self, **kw):
        """Login endpoint for mobile application
        
        Expected parameters:
        - mobile_phone: The mobile phone number of the sale person
        - pin: The PIN for authentication
        
        Returns:
        - success: Boolean indicating if login was successful
        - api_token: The API token to use for subsequent requests (if successful)
        - sale_person_id: The ID of the authenticated sale person (if successful)
        - sale_person_info: Basic information about the authenticated sale person (if successful)
        - error: Error message (if unsuccessful)
        """
        try:
            # Extract parameters
            mobile_phone = kw.get('mobile_phone')
            pin = kw.get('pin')
            
            if not mobile_phone or not pin:
                return {'success': False, 'error': _("Mobile phone and PIN are required")}
            
            # Find the sale person by mobile phone
            domain = [('mobile_phone', '=', mobile_phone)]
            
            sale_person = request.env['sale.person'].sudo().search(domain, limit=1)
            if not sale_person:
                return {'success': False, 'error': _("Sale person not found with the provided mobile phone number")}
            
            # Verify PIN
            if sale_person.pin != pin:
                return {'success': False, 'error': _("Invalid PIN")}
            
            # Check if the sale person has a token, generate one if not
            if not sale_person.token_for_sale_person:
                # Generate a secure random token
                import secrets
                token = secrets.token_hex(16)  # 32 character hex string
                
                # Update the sale person with the new token
                sale_person.sudo().write({'token_for_sale_person': token})
            
            # Get the running project in the sale person's location (only one at a time per location)
            running_project = None
            # Get available racks in the sale person's location
            available_racks = []
            
            if hasattr(sale_person, 'store_location') and sale_person.store_location:
                # Find the project that is in progress and in the same location as the sale person
                project = request.env['inventory.projects'].sudo().search([
                    ('state', '=', 'in_progress'),
                    ('location_id', '=', sale_person.store_location.id)
                ], limit=1)
                
                # Format project data if found
                if project:
                    running_project = {
                        'id': project.id,
                        'name': project.name,
                        'location_id': project.location_id.id,
                        'location_name': project.location_id.display_name,
                        'start_date': project.start_date.strftime('%Y-%m-%d') if project.start_date else '',
                    }
                
                # Find all active racks in the sale person's location
                racks = request.env['stock.rack'].sudo().search([
                    ('store_location_id', '=', sale_person.store_location.id),
                    ('active', '=', True)
                ])
                
                # Format rack data
                for rack in racks:
                    available_racks.append({
                        'id': rack.id,
                        'name': rack.name,
                        'location_id': rack.store_location_id.id,
                        'location_name': rack.store_location_id.display_name,
                        'note': rack.note or ''
                    })
            
            # Return success with token, sale person info, running project, and available racks
            return {
                'success': True,
                'api_token': sale_person.token_for_sale_person,
                'sale_person_id': sale_person.id,
                'sale_person_info': {
                    'id': sale_person.id,
                    'name': sale_person.name,
                    'mobile_phone': sale_person.mobile_phone if hasattr(sale_person, 'mobile_phone') else '',
                    'store_location': sale_person.store_location.id if hasattr(sale_person, 'store_location') and sale_person.store_location else '',
                    'store_location_name': sale_person.store_location.display_name if hasattr(sale_person, 'store_location') and sale_person.store_location else ''
                },
                'running_project': running_project,
                'available_racks': available_racks
            }
            
        except Exception as e:
            _logger.exception("Error in login: %s", str(e))
            return {'success': False, 'error': str(e)}
    
    @http.route('/inventory_app/logout', type='json', auth='none', methods=['POST'], csrf=False)
    def logout(self, **kw):
        """Logout endpoint for mobile application
        
        This endpoint invalidates the current API token for security.
        A new token will be generated on next login.
        
        Returns:
        - success: Boolean indicating if logout was successful
        - error: Error message (if unsuccessful)
        """
        try:
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            # Don't try to modify headers as they are immutable
            
            # Authenticate sale person using our own method
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Invalidate the API token by generating a new one that's not shared with the client
            import secrets
            new_token = secrets.token_hex(16)
            sale_person.sudo().write({'token_for_sale_person': new_token})
            
            return {
                'success': True,
                'message': _('Successfully logged out')
            }
            
        except Exception as e:
            _logger.exception("Error in logout: %s", str(e))
            return {'success': False, 'error': str(e)}
    
    @http.route('/inventory_app/refresh_token', type='json', auth='none', methods=['POST'], csrf=False)
    def refresh_token(self, **kw):
        """Refresh API token endpoint for mobile application
        
        This endpoint generates a new API token while invalidating the old one.
        Used to periodically refresh tokens for security without requiring re-login.
        
        Returns:
        - success: Boolean indicating if token refresh was successful
        - api_token: The new API token to use for subsequent requests (if successful)
        - error: Error message (if unsuccessful)
        """
        try:
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            # Don't try to modify headers as they are immutable
            
            # Authenticate sale person using our own method
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Generate a new token
            import secrets
            new_token = secrets.token_hex(16)  # 32 character hex string
            
            # Update the sale person with the new token
            sale_person.sudo().write({'token_for_sale_person': new_token})
            
            return {
                'success': True,
                'api_token': new_token,
                'message': _('API token refreshed successfully')
            }
            
        except Exception as e:
            _logger.exception("Error in refresh_token: %s", str(e))
            return {'success': False, 'error': str(e)}
    
    def _authenticate_sale_person(self, api_token=None):
        """Custom authentication method for sale person"""
        # First check if api_token was passed as a parameter
        if not api_token:
            # If not, try to get it from headers
            api_token = request.httprequest.headers.get('api_token') or request.httprequest.headers.get('Authorization')
        
        if not api_token:
            return None, None, json.dumps({'success': False, 'message': 'Authentication token is required'})
            
        # Find the sale person by token
        sale_person = request.env['sale.person'].sudo().search([('token_for_sale_person', '=', api_token)], limit=1)
        if not sale_person:
            return None, None, json.dumps({'success': False, 'message': 'Invalid authentication token'})
            
        # Return the sale person and a placeholder for user_id (for backward compatibility)
        # The actual user_id is not used in most methods
        return sale_person, 0, None
    
    @http.route('/inventory_app/create_submission', type='json', auth='none', methods=['POST'], csrf=False)
    def create_submission(self, **kw):
        """Create a batch submission with multiple scan lines"""
        try:
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            # Don't try to modify headers as they are immutable
                
            project_id = kw.get('project_id')
            rack_id = kw.get('rack_id')  # Optional default rack
            notes = kw.get('notes', '')
            scan_lines = kw.get('scan_lines', [])
            previous_submission_id = kw.get('previous_submission_id')  # For re-inventory
            scanned_lot_name = kw.get('scanned_lot_name')  # For scanner-based re-inventory
            
            if not project_id or not scan_lines:
                return {'success': False, 'error': _("Project ID and scan lines are required")}
            
            # Authenticate sale person using our own method
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Find the project
            project = request.env['inventory.projects'].sudo().browse(int(project_id))
            if not project.exists():
                return {'success': False, 'error': _("Project not found")}
                
            if project.state != 'in_progress':
                return {'success': False, 'error': _("Project is not in progress")}
            
            # First validate all scan lines before creating any
            validation_results = []
            all_valid = True
            
            for scan_data in scan_lines:
                lot_name = scan_data.get('lot_name')
                lot_id = scan_data.get('lot_id')
                scanned_qty = scan_data.get('scanned_qty')
                
                result = {
                    'lot_name': lot_name or '',
                    'lot_id': lot_id,
                    'success': False
                }
                
                # Validate required fields
                if not (lot_name or lot_id) or scanned_qty is None:
                    result['error'] = _("Lot information and scanned quantity are required")
                    validation_results.append(result)
                    all_valid = False
                    continue
                
                # Find the lot
                lot = None
                if lot_id:
                    lot = request.env['stock.production.lot'].sudo().browse(int(lot_id))
                elif lot_name:
                    lot = request.env['stock.production.lot'].sudo().search([('name', '=', lot_name)], limit=1)
                
                if not lot or not lot.exists():
                    result['error'] = _("Lot not found")
                    validation_results.append(result)
                    all_valid = False
                    continue
                
                # Get the product from the lot
                product = lot.product_id
                
                # Mark as valid
                result['success'] = True
                result['product_id'] = product.id
                result['product_name'] = product.name
                validation_results.append(result)
            
            # If any line is invalid, return error without creating submission
            if not all_valid:
                return {
                    'success': False,
                    'error': _("All scan lines must be valid to create a submission"),
                    'scan_lines': validation_results
                }
            
            # Create submission
            submission_vals = {
                'project_id': project.id,
                'sale_person_id': sale_person.id,
                'notes': notes,
                'state': 'draft'
            }
            
            # If this is a re-inventory submission with explicit previous_submission_id, link it
            prev_submission = None
            if previous_submission_id:
                try:
                    prev_submission = request.env['inventory.submission'].sudo().browse(int(previous_submission_id))
                    if prev_submission.exists() and prev_submission.state == 'validated':
                        submission_vals['previous_submission_id'] = prev_submission.id
                        # Add note about this being a re-inventory
                        if notes:
                            submission_vals['notes'] = notes + "\n" + _("Re-inventory based on submission %s") % prev_submission.name
                        else:
                            submission_vals['notes'] = _("Re-inventory based on submission %s") % prev_submission.name
                            
                        # If the previous submission has a product_id, use it for consistency
                        if prev_submission.product_id:
                            submission_vals['product_id'] = prev_submission.product_id.id
                except Exception as e:
                    _logger.warning("Error linking to previous submission: %s", str(e))
            
            # If no previous_submission_id but scanned_lot_name is provided, try to find previous submission
            elif scanned_lot_name and not prev_submission:
                try:
                    # Find the lot by name
                    lot = request.env['stock.production.lot'].sudo().search([('name', '=', scanned_lot_name)], limit=1)
                    if lot and lot.exists():
                        # Find previous validated submissions for this lot
                        domain = [
                            ('state', '=', 'validated'),
                            ('scan_line_ids.lot_id', '=', lot.id)
                        ]
                        
                        # Add location filter if project has location
                        if project.location_id:
                            domain.append(('project_location_id', '=', project.location_id.id))
                        
                        prev_submissions = request.env['inventory.submission'].sudo().search(
                            domain, order='validation_datetime DESC', limit=1
                        )
                        
                        if prev_submissions:
                            prev_submission = prev_submissions[0]
                            submission_vals['previous_submission_id'] = prev_submission.id
                            
                            # Add note about this being an auto-detected re-inventory
                            auto_note = _("Auto-detected re-inventory based on lot %s (submission %s)") % (scanned_lot_name, prev_submission.name)
                            if notes:
                                submission_vals['notes'] = notes + "\n" + auto_note
                            else:
                                submission_vals['notes'] = auto_note
                                
                            # If the previous submission has a product_id, use it for consistency
                            if prev_submission.product_id:
                                submission_vals['product_id'] = prev_submission.product_id.id
                except Exception as e:
                    _logger.warning("Error auto-detecting previous submission: %s", str(e))
            
            # Check if all scan lines are for the same product
            product_ids = set()
            for scan_data in scan_lines:
                lot_id = scan_data.get('lot_id')
                lot_name = scan_data.get('lot_name')
                
                # Find the lot (we already validated it exists)
                lot = None
                if lot_id:
                    lot = request.env['stock.production.lot'].sudo().browse(int(lot_id))
                elif lot_name:
                    lot = request.env['stock.production.lot'].sudo().search([('name', '=', lot_name)], limit=1)
                
                product_ids.add(lot.product_id.id)
            
            # If all scan lines are for the same product, set it on the submission
            if len(product_ids) == 1:
                submission_vals['product_id'] = list(product_ids)[0]
            
            if rack_id:
                rack = request.env['stock.rack'].sudo().browse(int(rack_id))
                if rack.exists():
                    submission_vals['rack_id'] = rack.id
                    
            # Create the submission
            submission = request.env['inventory.submission'].sudo().create(submission_vals)
            
            # Now create all scan lines
            scan_line_results = []
            
            for i, scan_data in enumerate(scan_lines):
                lot_name = scan_data.get('lot_name')
                lot_id = scan_data.get('lot_id')
                scanned_qty = scan_data.get('scanned_qty')
                line_rack_id = scan_data.get('rack_id', rack_id)  # Use submission rack as default
                line_notes = scan_data.get('notes', '')
                
                # Find the lot (we already validated it exists)
                lot = None
                if lot_id:
                    lot = request.env['stock.production.lot'].sudo().browse(int(lot_id))
                elif lot_name:
                    lot = request.env['stock.production.lot'].sudo().search([('name', '=', lot_name)], limit=1)
                
                # Get the product from the lot
                product = lot.product_id
                
                # Create scan line
                scan_line_vals = {
                    'submission_id': submission.id,
                    'project_id': project.id,
                    'product_id': product.id,
                    'lot_id': lot.id,
                    'scanned_qty': float(scanned_qty),
                    'sale_person_id': sale_person.id,
                    'state': 'draft'  # Draft until submission is submitted
                }
                
                # Store the lot_name if it was provided (useful for traceability)
                if lot_name:
                    scan_line_vals['lot_name'] = lot_name
                
                if line_rack_id:
                    scan_line_vals['rack_id'] = int(line_rack_id)
                    
                if line_notes:
                    scan_line_vals['notes'] = f"Sale Person: {sale_person.name} - {line_notes}"
                else:
                    scan_line_vals['notes'] = f"Sale Person: {sale_person.name}"
                
                scan_line = request.env['inventory.scan.line'].sudo().create(scan_line_vals)
                
                # Update result with scan_id
                result = validation_results[i]
                result['scan_id'] = scan_line.id
                scan_line_results.append(result)
            
            # Submit the submission
            submission.sudo().action_submit()
            
            # Prepare response data
            response_data = {
                'success': True,
                'submission_id': submission.id,
                'submission_reference': submission.name,
                'scan_lines': scan_line_results,
                'valid_lines': len(scan_lines),
                'invalid_lines': 0
            }
            
            # Add re-inventory information if applicable
            if previous_submission_id and submission.previous_submission_id:
                response_data['is_reinventory'] = True
                response_data['previous_submission_id'] = submission.previous_submission_id.id
                response_data['previous_submission_reference'] = submission.previous_submission_id.name
            
            return response_data
        except Exception as e:
            _logger.exception("Error in create_submission: %s", str(e))
            return {'success': False, 'error': str(e)}
    @http.route('/inventory_app/update_submission', type='json', auth='none', methods=['POST'], csrf=False)
    def update_submission(self, **kw):
        """Update an existing submission"""
        try:
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            # Don't try to modify headers as they are immutable
                
            submission_id = kw.get('submission_id')
            scan_lines_to_add = kw.get('scan_lines_to_add', [])
            scan_lines_to_update = kw.get('scan_lines_to_update', [])
            scan_lines_to_remove = kw.get('scan_lines_to_remove', [])
            
            if not submission_id:
                return {'success': False, 'error': _("Submission ID is required")}
            
            # Authenticate sale person using our own method
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Find the submission
            submission = request.env['inventory.submission'].sudo().browse(int(submission_id))
            if not submission.exists():
                return {'success': False, 'error': _("Submission not found")}
            
            # Check if submission can be modified
            if submission.state not in ['draft', 'submitted']:
                return {'success': False, 'error': _("Only draft or submitted submissions can be modified")}
            
            # Check if user is the owner of the submission
            if submission.sale_person_id.id != sale_person.id:
                return {'success': False, 'error': _("You can only modify your own submissions")}
                
            # Get the product_id of the submission
            submission_product_id = submission.product_id.id if submission.product_id else None
            
            # Process updates
            results = {
                'added': [],
                'updated': [],
                'removed': [],
                'errors': []
            }
            
            # Process lines to add
            for scan_data in scan_lines_to_add:
                lot_name = scan_data.get('lot_name')
                lot_id = scan_data.get('lot_id')
                scanned_qty = scan_data.get('scanned_qty')
                rack_id = scan_data.get('rack_id', submission.rack_id.id if submission.rack_id else False)
                notes = scan_data.get('notes', '')
                
                result = {
                    'lot_name': lot_name or '',
                    'lot_id': lot_id,
                    'success': False
                }
                
                # Validate required fields
                if not (lot_name or lot_id) or scanned_qty is None:
                    result['error'] = _("Lot information and scanned quantity are required")
                    results['errors'].append(result)
                    continue
                
                # Find the lot
                lot = None
                if lot_id:
                    lot = request.env['stock.production.lot'].sudo().browse(int(lot_id))
                elif lot_name:
                    lot = request.env['stock.production.lot'].sudo().search([('name', '=', lot_name)], limit=1)
                
                if not lot or not lot.exists():
                    result['error'] = _("Lot not found")
                    results['errors'].append(result)
                    continue
                
                # Get the product from the lot
                product = lot.product_id
                
                # Create scan line
                scan_line_vals = {
                    'submission_id': submission.id,
                    'project_id': submission.project_id.id,
                    'product_id': product.id,
                    'lot_id': lot.id,
                    'scanned_qty': float(scanned_qty),
                    'sale_person_id': sale_person.id,
                    'state': 'draft' if submission.state == 'draft' else 'submitted'
                }
                
                if rack_id:
                    scan_line_vals['rack_id'] = int(rack_id)
                    
                if notes:
                    scan_line_vals['notes'] = f"Sale Person: {sale_person.name} - {notes}"
                else:
                    scan_line_vals['notes'] = f"Sale Person: {sale_person.name}"
                
                scan_line = request.env['inventory.scan.line'].sudo().create(scan_line_vals)
                
                # Update result
                result.update({
                    'success': True,
                    'scan_id': scan_line.id,
                    'product_id': product.id,
                    'product_name': product.name
                })
                
                results['added'].append(result)
            
            # Process lines to update
            for update_data in scan_lines_to_update:
                scan_line_id = update_data.get('scan_line_id')
                if not scan_line_id:
                    results['errors'].append({'error': _("Scan line ID is required for updates")})
                    continue
                    
                scan_line = request.env['inventory.scan.line'].sudo().browse(int(scan_line_id))
                if not scan_line.exists() or scan_line.submission_id.id != submission.id:
                    results['errors'].append({'error': _("Scan line not found in this submission"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Check if line can be updated
                if scan_line.state not in ['draft', 'submitted']:
                    results['errors'].append({'error': _("Only draft or submitted scan lines can be updated"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Update values
                update_vals = {}
                if 'scanned_qty' in update_data:
                    update_vals['scanned_qty'] = float(update_data['scanned_qty'])
                if 'rack_id' in update_data:
                    update_vals['rack_id'] = int(update_data['rack_id'])
                if 'notes' in update_data:
                    update_vals['notes'] = f"Sale Person: {sale_person.name} - {update_data['notes']}"
                    
                if update_vals:
                    scan_line.write(update_vals)
                    results['updated'].append({
                        'scan_line_id': scan_line.id,
                        'success': True
                    })
            
            # Process lines to remove
            for scan_line_id in scan_lines_to_remove:
                scan_line = request.env['inventory.scan.line'].sudo().browse(int(scan_line_id))
                if not scan_line.exists() or scan_line.submission_id.id != submission.id:
                    results['errors'].append({'error': _("Scan line not found in this submission"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Check if line can be removed
                if scan_line.state not in ['draft', 'submitted']:
                    results['errors'].append({'error': _("Only draft or submitted scan lines can be removed"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Remove the line
                scan_line.unlink()
                results['removed'].append(scan_line_id)
            
            return {
                'success': True,
                'submission_id': submission.id,
                'results': results
            }
                
        except Exception as e:
            _logger.exception("Error in update_submission: %s", str(e))
            return {'success': False, 'error': str(e)}

    @http.route('/inventory_app/get_submissions', type='json', auth='none', methods=['POST'], csrf=False)
    def get_submissions(self, **kw):
        """Get list of submissions for a project or sale person"""
        try:
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            # Don't try to modify headers as they are immutable
                
            project_id = kw.get('project_id')
            limit = kw.get('limit', 20)  # Default to 20 records
            offset = kw.get('offset', 0)  # Default to first page
            order = kw.get('order', 'id desc')  # Default to newest first
            
            # Convert to integers
            if limit: limit = int(limit)
            if offset: offset = int(offset)
            
            # Authenticate sale person using our own method
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Build domain
            domain = [('sale_person_id', '=', sale_person.id)]
            if project_id:
                domain.append(('project_id', '=', int(project_id)))
            
            # Get total count for pagination info
            total_count = request.env['inventory.submission'].sudo().search_count(domain)
            
            # Get submissions with pagination
            submissions = request.env['inventory.submission'].sudo().search(domain, limit=limit, offset=offset, order=order)
            
            # Format submission data
            submission_list = []
            for submission in submissions:
                submission_list.append({
                    'id': submission.id,
                    'name': submission.name,
                    'project_id': submission.project_id.id,
                    'project_name': submission.project_id.name,
                    'submission_datetime': submission.submission_datetime,
                    'state': submission.state,
                    'scan_count': submission.scan_count,
                    'validated_count': submission.validated_count,

                    'rack_id': submission.rack_id.id if submission.rack_id else False,
                    'rack_name': submission.rack_id.name if submission.rack_id else '',
                    'notes': submission.notes or ''
                })
            
            return {
                'success': True,
                'submissions': submission_list,
                'pagination': {
                    'total_count': total_count,
                    'limit': limit,
                    'offset': offset,
                    'has_more': (offset + len(submission_list)) < total_count
                }
            }
            
        except Exception as e:
            _logger.exception("Error in get_submissions: %s", str(e))
            return {'success': False, 'error': str(e)}
    
    @http.route('/inventory_app/get_submission_scan_lines', type='json', auth='none', methods=['POST'], csrf=False)
    def get_submission_scan_lines(self, **kw):
        """Get scan lines for a specific submission"""
        try:
            # Debug: Log all received parameters
            _logger.info("📊 get_submission_scan_lines received parameters: %s", kw)
            
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            # Don't try to modify headers as they are immutable
            
            submission_id = kw.get('submission_id')
            order = kw.get('order', 'id asc')  # Default to oldest first
            
            _logger.info("📊 Extracted submission_id: %s (type: %s)", submission_id, type(submission_id))
            
            if not submission_id:
                return {'success': False, 'error': _("Submission ID is required")}
            
            # Authenticate sale person
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Find the submission
            submission = request.env['inventory.submission'].sudo().browse(int(submission_id))
            if not submission.exists():
                return {'success': False, 'error': _("Submission not found")}
            
            # Check if user is the owner of the submission
            if submission.sale_person_id.id != sale_person.id:
                return {'success': False, 'error': _("You can only view your own submissions")}
            
            # Get all scan lines for this submission
            scan_lines = request.env['inventory.scan.line'].sudo().search([
                ('submission_id', '=', submission.id)
            ], order=order)
            
            # Format scan line data
            scan_line_list = []
            for line in scan_lines:
                scan_line_list.append({
                    'id': line.id,
                    'lot_id': line.lot_id.id,
                    'lot_name': line.lot_id.name,
                    'product_id': line.product_id.id,
                    'product_name': line.product_id.name,
                    'scanned_qty': line.scanned_qty,
                    'theoretical_qty': line.theoretical_qty,
                    'change_qty': line.change_qty,
                    'state': line.state,
                    'rack_id': line.rack_id.id if line.rack_id else False,
                    'rack_name': line.rack_id.name if line.rack_id else ''
                })
            
            return {
                'success': True,
                'submission_id': submission.id,
                'submission_name': submission.name,
                'scan_count': len(scan_line_list),
                'scan_lines': scan_line_list
            }
            
        except Exception as e:
            _logger.exception("Error in get_submission_scan_lines: %s", str(e))
            return {'success': False, 'error': str(e)}


    @http.route('/inventory_app/get_previous_submission_details', type='json', auth='none', methods=['POST'], csrf=False)
    def get_previous_submission_details(self, **kw):
        """Get details of a previous submission for re-inventory purposes
        
        Expected parameters:
        - api_token: API token for authentication
        - submission_id: ID of the previous submission to get details for
        
        Returns:
        - success: Boolean indicating if the operation was successful
        - submission: Details of the previous submission
        - scan_lines: Scan lines from the previous submission
        - error: Error message (if unsuccessful)
        """
        try:
            # Extract parameters
            api_token = kw.get('api_token')
            submission_id = kw.get('submission_id')
            
            # Authenticate sale person
            sale_person = self._authenticate_sale_person(api_token=api_token)
            if not sale_person:
                return {'success': False, 'error': _('Authentication failed')}
                
            if not submission_id:
                return {'success': False, 'error': _('Submission ID is required')}
                
            # Find the submission
            submission = request.env['inventory.submission'].sudo().browse(int(submission_id))
            if not submission.exists():
                return {'success': False, 'error': _('Submission not found')}
                
            if submission.state != 'validated':
                return {'success': False, 'error': _('Can only use validated submissions for re-inventory')}
            
            # Format the submission data
            submission_data = {
                'id': submission.id,
                'name': submission.name,
                'project_id': submission.project_id.id,
                'project_name': submission.project_id.name,
                'location_id': submission.project_location_id.id,
                'location_name': submission.project_location_id.display_name,
                'product_id': submission.product_id.id if submission.product_id else False,
                'product_name': submission.product_id.name if submission.product_id else '',
                'rack_id': submission.rack_id.id if submission.rack_id else False,
                'rack_name': submission.rack_id.name if submission.rack_id else '',
                'submission_datetime': submission.submission_datetime.strftime('%Y-%m-%d %H:%M:%S') if submission.submission_datetime else '',
                'validation_datetime': submission.validation_datetime.strftime('%Y-%m-%d %H:%M:%S') if submission.validation_datetime else '',
                'validated_by': submission.validated_by_id.name if submission.validated_by_id else ''
            }
            
            # Format the scan lines
            scan_lines = []
            for line in submission.scan_line_ids:
                scan_lines.append({
                    'id': line.id,
                    'product_id': line.product_id.id,
                    'product_name': line.product_id.name,
                    'lot_id': line.lot_id.id,
                    'lot_name': line.lot_id.name,
                    'scanned_qty': line.scanned_qty,
                    'theoretical_qty': line.theoretical_qty,
                    'change_qty': line.change_qty,
                    'state': line.state,
                    'rack_id': line.rack_id.id if line.rack_id else False,
                    'rack_name': line.rack_id.name if line.rack_id else ''
                })
            
            return {
                'success': True,
                'submission': submission_data,
                'scan_lines': scan_lines
            }
            
        except Exception as e:
            _logger.exception("Error in get_previous_submission_details: %s", str(e))
            return {'success': False, 'error': str(e)}
    
    @http.route('/inventory_app/get_lot_info', type='json', auth='none', methods=['POST'], csrf=False)
    def get_lot_info(self, **kw):
        """Get information about a lot and related products"""
        try:
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            # Don't try to modify headers as they are immutable
                
            lot_name = kw.get('lot_name')
            location_id = kw.get('location_id')
            
            if not lot_name or not location_id:
                return {'success': False, 'error': _("Lot name and location ID are required")}
            
            # Authenticate sale person
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Find the lot
            lot = request.env['stock.production.lot'].sudo().search([('name', '=', lot_name)], limit=1)
            if not lot:
                return {'success': False, 'error': _("Lot not found")}
            
            # Find the location
            location = request.env['stock.location'].sudo().browse(int(location_id))
            if not location.exists():
                return {'success': False, 'error': _("Location not found")}
            
            # Get product info
            product = lot.product_id
            
            # Get current quantity for this specific lot at this location
            query = """
                SELECT SUM(quantity) as qty
                FROM stock_quant
                WHERE product_id = %s
                AND lot_id = %s
                AND location_id = %s
            """
            request.env.cr.execute(query, (product.id, lot.id, location.id))
            result = request.env.cr.fetchone()
            lot_qty = result[0] if result and result[0] else 0.0
            
            # Get inventoried quantity for this lot
            # Note: inventory_scan_line doesn't have location_id field directly
            # We'll need to get the inventory lines for this lot that have been validated
            inventoried_qty = 0.0
            inventory_lines = request.env['inventory.scan.line'].sudo().search([
                ('lot_id', '=', lot.id),
                ('state', '=', 'validated')
            ])
            if inventory_lines:
                inventoried_qty = sum(line.scanned_qty for line in inventory_lines)
            
            # Get total quantity for this product at this location
            query = """
                SELECT SUM(quantity) as total_qty
                FROM stock_quant
                WHERE product_id = %s
                AND location_id = %s
            """
            request.env.cr.execute(query, (product.id, location.id))
            result = request.env.cr.fetchone()
            total_qty = result[0] if result and result[0] else 0.0
            
            # Get all lots for this product at this location
            query = """
                SELECT sq.lot_id, spl.name as lot_name, SUM(sq.quantity) as qty
                FROM stock_quant sq
                JOIN stock_production_lot spl ON sq.lot_id = spl.id
                WHERE sq.product_id = %s
                AND sq.location_id = %s
                GROUP BY sq.lot_id, spl.name
                HAVING SUM(sq.quantity) > 0
            """
            request.env.cr.execute(query, (product.id, location.id))
            
            product_lots = []
            for lot_id, lot_name, qty in request.env.cr.fetchall():
                # Get inventoried quantity for this lot
                # Note: inventory_scan_line doesn't have location_id field directly
                inv_qty = 0.0
                inv_lines = request.env['inventory.scan.line'].sudo().search([
                    ('lot_id', '=', lot_id),
                    ('state', '=', 'validated')
                ])
                if inv_lines:
                    inv_qty = sum(line.scanned_qty for line in inv_lines)
                
                product_lots.append({
                    'lot_id': lot_id,
                    'product_id': product.id,
                    'lot_inventoried_stock': inv_qty,
                    'lot_stock': qty,
                    'product_stock': total_qty
                })
            
            # Prepare main response object
            response_data = {
                'lot_id': lot.id,
                'product_id': product.id,
                'lot_inventoried_stock': inventoried_qty,
                'lot_stock': lot_qty,
                'product_stock': total_qty,
                'product_lots': product_lots
            }
            
            return {
                'success': True,
                'data': [response_data]  # Wrapped in array to match expected format
            }
            
        except Exception as e:
            _logger.exception("Error in get_lot_info: %s", str(e))
            return {'success': False, 'error': str(e)}
            
    @http.route('/inventory_app/modify_submitted', type='json', auth='none', methods=['POST'], csrf=False)
    def modify_submitted(self, **kw):
        """Modify a submission that is in 'submitted' state but not yet validated
        
        Expected parameters:
        - api_token: API token for authentication
        - submission_id: ID of the submission to modify
        - scan_lines_to_add: List of scan lines to add to the submission
        - scan_lines_to_update: List of scan lines to update in the submission
        - scan_lines_to_remove: List of scan line IDs to remove from the submission
        
        Returns:
        - success: Boolean indicating if the operation was successful
        - submission_id: ID of the modified submission
        - results: Detailed results of the operation
        - error: Error message (if unsuccessful)
        """
        try:
            # Extract parameters
            api_token = kw.get('api_token') or request.httprequest.headers.get('Authorization')
            submission_id = kw.get('submission_id')
            scan_lines_to_add = kw.get('scan_lines_to_add', [])
            scan_lines_to_update = kw.get('scan_lines_to_update', [])
            scan_lines_to_remove = kw.get('scan_lines_to_remove', [])
            
            if not submission_id:
                return {'success': False, 'error': _("Submission ID is required")}
            
            # Authenticate sale person using our own method
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
            
            # Find the submission
            submission = request.env['inventory.submission'].sudo().browse(int(submission_id))
            if not submission.exists():
                return {'success': False, 'error': _("Submission not found")}
            
            # Check if submission is in 'submitted' state
            if submission.state != 'submitted':
                return {'success': False, 'error': _("Only submissions in 'submitted' state can be modified with this endpoint")}
            
            # Check if user is the owner of the submission
            if submission.sale_person_id.id != sale_person.id:
                return {'success': False, 'error': _("You can only modify your own submissions")}
                
            # Process updates
            results = {
                'added': [],
                'updated': [],
                'removed': [],
                'errors': []
            }
            
            # Process lines to add
            for scan_data in scan_lines_to_add:
                lot_name = scan_data.get('lot_name')
                lot_id = scan_data.get('lot_id')
                scanned_qty = scan_data.get('scanned_qty')
                rack_id = scan_data.get('rack_id', submission.rack_id.id if submission.rack_id else False)
                notes = scan_data.get('notes', '')
                
                result = {
                    'lot_name': lot_name or '',
                    'lot_id': lot_id,
                    'success': False
                }
                
                # Validate required fields
                if not (lot_name or lot_id) or scanned_qty is None:
                    result['error'] = _("Lot information and scanned quantity are required")
                    results['errors'].append(result)
                    continue
                
                # Find the lot
                lot = None
                if lot_id:
                    lot = request.env['stock.production.lot'].sudo().browse(int(lot_id))
                elif lot_name:
                    lot = request.env['stock.production.lot'].sudo().search([('name', '=', lot_name)], limit=1)
                
                if not lot or not lot.exists():
                    result['error'] = _("Lot not found")
                    results['errors'].append(result)
                    continue
                
                # Get the product from the lot
                product = lot.product_id
                
                # Check product consistency if submission has a product_id
                if submission.product_id and submission.product_id.id != product.id:
                    result['error'] = _("Cannot add a scan line with product ID %s to a submission with product ID %s.") % \
                                     (product.id, submission.product_id.id)
                    results['errors'].append(result)
                    continue
                
                # Create scan line
                scan_line_vals = {
                    'submission_id': submission.id,
                    'project_id': submission.project_id.id,
                    'product_id': product.id,
                    'lot_id': lot.id,
                    'scanned_qty': float(scanned_qty),
                    'sale_person_id': sale_person.id,
                    'state': 'submitted'  # Set to submitted since the submission is already submitted
                }
                
                if rack_id:
                    scan_line_vals['rack_id'] = int(rack_id)
                    
                if notes:
                    scan_line_vals['notes'] = f"Sale Person: {sale_person.name} - {notes}"
                else:
                    scan_line_vals['notes'] = f"Sale Person: {sale_person.name}"
                
                scan_line = request.env['inventory.scan.line'].sudo().create(scan_line_vals)
                
                # Update result
                result.update({
                    'success': True,
                    'scan_id': scan_line.id,
                    'product_id': product.id,
                    'product_name': product.name
                })
                
                results['added'].append(result)
            
            # Process lines to update
            for update_data in scan_lines_to_update:
                scan_line_id = update_data.get('scan_line_id')
                if not scan_line_id:
                    results['errors'].append({'error': _("Scan line ID is required for updates")})
                    continue
                    
                scan_line = request.env['inventory.scan.line'].sudo().browse(int(scan_line_id))
                if not scan_line.exists() or scan_line.submission_id.id != submission.id:
                    results['errors'].append({'error': _("Scan line not found in this submission"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Check if line is in submitted state
                if scan_line.state != 'submitted':
                    results['errors'].append({'error': _("Only scan lines in 'submitted' state can be updated"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Update values
                update_vals = {}
                if 'scanned_qty' in update_data:
                    update_vals['scanned_qty'] = float(update_data['scanned_qty'])
                if 'rack_id' in update_data and update_data['rack_id']:
                    update_vals['rack_id'] = int(update_data['rack_id'])
                if 'notes' in update_data:
                    update_vals['notes'] = f"Sale Person: {sale_person.name} - {update_data['notes']}"
                    
                if update_vals:
                    scan_line.write(update_vals)
                    results['updated'].append({
                        'scan_line_id': scan_line.id,
                        'success': True
                    })
            
            # Process lines to remove
            for scan_line_id in scan_lines_to_remove:
                scan_line = request.env['inventory.scan.line'].sudo().browse(int(scan_line_id))
                if not scan_line.exists() or scan_line.submission_id.id != submission.id:
                    results['errors'].append({'error': _("Scan line not found in this submission"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Check if line is in submitted state
                if scan_line.state != 'submitted':
                    results['errors'].append({'error': _("Only scan lines in 'submitted' state can be removed"), 'scan_line_id': scan_line_id})
                    continue
                    
                # Remove the line
                scan_line.unlink()
                results['removed'].append(scan_line_id)
            
            # Add a note to the submission about the modification
            modification_summary = []
            if results['added']:
                modification_summary.append(_("Added %s new scan lines") % len(results['added']))
            if results['updated']:
                modification_summary.append(_("Updated %s existing scan lines") % len(results['updated']))
            if results['removed']:
                modification_summary.append(_("Removed %s scan lines") % len(results['removed']))
                
            if modification_summary:
                submission.message_post(
                    body=_("Submission modified after submission: %s") % ", ".join(modification_summary)
                )
            
            return {
                'success': True,
                'submission_id': submission.id,
                'results': results
            }
                
        except Exception as e:
            _logger.exception("Error in modify_submitted: %s", str(e))
            return {'success': False, 'error': str(e)}
            
    @http.route('/inventory_app/check_previous_submissions', type='json', auth='none', methods=['POST'], csrf=False)
    def check_previous_submissions(self, **kw):
        """Check for previous validated submissions for a scanned lot
        
        Expected parameters:
        - api_token: API token for authentication
        - lot_name: Name of the lot scanned by the scanner
        - location_id: (Optional) ID of the location to check
        
        Returns:
        - success: Boolean indicating if the check was successful
        - has_previous: Boolean indicating if there are previous submissions
        - lot_info: Information about the scanned lot (product, name, etc.)
        - previous_submissions: List of previous submissions with their scan lines
        - error: Error message (if unsuccessful)
        """
        try:
            # Extract parameters
            api_token = kw.get('api_token')
            lot_name = kw.get('lot_name')
            location_id = kw.get('location_id')
            
            # Authenticate sale person
            sale_person, user_id, error_response = self._authenticate_sale_person(api_token=api_token)
            if error_response:
                return {'success': False, 'error': json.loads(error_response).get('message', 'Authentication failed')}
                
            if not lot_name:
                return {'success': False, 'error': _('Lot name is required')}
                
            # Find the lot by name
            lot = request.env['stock.production.lot'].sudo().search([
                ('name', '=', lot_name)
            ], limit=1)
            
            if not lot:
                return {'success': False, 'error': _('Lot not found: %s') % lot_name}
                
            product_id = lot.product_id.id
            lot_id = lot.id
            
            # Prepare domain for submissions
            domain = [
                ('state', '=', 'validated'),
                ('scan_line_ids.lot_id', '=', lot_id)
            ]
            
            # Add location filter if provided
            if location_id:
                domain.append(('project_location_id', '=', int(location_id)))
            
            # Find submissions with this lot
            submissions = request.env['inventory.submission'].sudo().search(domain, order='validation_datetime DESC')
            
            # Format the submissions data
            previous_submissions = []
            for submission in submissions:
                # Only include scan lines for this lot
                lot_scan_lines = []
                for line in submission.scan_line_ids:
                    if line.lot_id.id == lot_id:
                        lot_scan_lines.append({
                            'id': line.id,
                            'product_id': line.product_id.id,
                            'product_name': line.product_id.name,
                            'lot_id': line.lot_id.id,
                            'lot_name': line.lot_id.name,
                            'scanned_qty': line.scanned_qty,
                            'theoretical_qty': line.theoretical_qty,
                            'change_qty': line.change_qty,
                            'state': line.state,
                            'rack_id': line.rack_id.id if line.rack_id else False,
                            'rack_name': line.rack_id.name if line.rack_id else ''
                        })
                
                if lot_scan_lines:
                    previous_submissions.append({
                        'id': submission.id,
                        'name': submission.name,
                        'submission_datetime': submission.submission_datetime.strftime('%Y-%m-%d %H:%M:%S') if submission.submission_datetime else '',
                        'validation_datetime': submission.validation_datetime.strftime('%Y-%m-%d %H:%M:%S') if submission.validation_datetime else '',
                        'validated_by': submission.validated_by_id.name if submission.validated_by_id else '',
                        'project_id': submission.project_id.id,
                        'project_name': submission.project_id.name,
                        'location_id': submission.project_location_id.id,
                        'location_name': submission.project_location_id.display_name,
                        'scan_lines': lot_scan_lines
                    })
            
            # Prepare lot information
            lot_info = {
                'id': lot.id,
                'name': lot.name,
                'product_id': lot.product_id.id,
                'product_name': lot.product_id.name,
                'product_code': lot.product_id.default_code or '',
                'uom': lot.product_id.uom_id.name
            }
            
            return {
                'success': True,
                'has_previous': len(previous_submissions) > 0,
                'lot_info': lot_info,
                'previous_submissions': previous_submissions
            }
            
        except Exception as e:
            _logger.exception("Error in check_previous_submissions: %s", str(e))
            return {'success': False, 'error': str(e)}
