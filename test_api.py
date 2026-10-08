import urllib.request
import json

def test_api():
    base = 'http://127.0.0.1:8000'
    
    # 1. Test blockchain chain
    res = json.loads(urllib.request.urlopen(f'{base}/api/blockchain/chain').read().decode())
    assert res['isValid'] == True, 'Chain invalid'
    print('[+] Blockchain Genesis & Validation: OK')
    
    # 2. Test Admin Login
    req = urllib.request.Request(
        f'{base}/api/auth/login', 
        data=json.dumps({'role':'admin', 'email':'admin@blockchain.edu', 'password':'admin123'}).encode(),
        headers={'Content-Type':'application/json'}
    )
    admin_res = json.loads(urllib.request.urlopen(req).read().decode())
    assert admin_res['success'] == True, 'Admin login failed'
    print('[+] Admin Authentication: OK')

    # 3. Test Student Registration with custom Gmail & Password
    reg_s_req = urllib.request.Request(
        f'{base}/api/auth/register',
        data=json.dumps({
            'role': 'student',
            'name': 'Test Student',
            'email': 'student.test@gmail.com',
            'password': 'mypassword789',
            'usn': '1SI22CS999',
            'sectionId': 's1'
        }).encode(),
        headers={'Content-Type': 'application/json'}
    )
    reg_s_res = json.loads(urllib.request.urlopen(reg_s_req).read().decode())
    assert reg_s_res['success'] == True, 'Student registration failed'
    print('[+] Student Registration with Gmail & Password: OK')

    # 4. Test Student Login with newly registered Gmail & Password
    login_s_req = urllib.request.Request(
        f'{base}/api/auth/login',
        data=json.dumps({
            'role': 'student',
            'email': 'student.test@gmail.com',
            'password': 'mypassword789'
        }).encode(),
        headers={'Content-Type': 'application/json'}
    )
    login_s_res = json.loads(urllib.request.urlopen(login_s_req).read().decode())
    assert login_s_res['success'] == True, 'Student login failed'
    print('[+] Student Login with Registered Gmail & Password: OK')

    # 5. Test Teacher Registration with custom Gmail & Password
    reg_t_req = urllib.request.Request(
        f'{base}/api/auth/register',
        data=json.dumps({
            'role': 'teacher',
            'name': 'Prof. Test',
            'email': 'teacher.test@gmail.com',
            'password': 'teachpass123',
            'department': 'Computer Science'
        }).encode(),
        headers={'Content-Type': 'application/json'}
    )
    reg_t_res = json.loads(urllib.request.urlopen(reg_t_req).read().decode())
    assert reg_t_res['success'] == True, 'Teacher registration failed'
    print('[+] Teacher Registration with Gmail & Password: OK')

    # 6. Test Teacher Login
    login_t_req = urllib.request.Request(
        f'{base}/api/auth/login',
        data=json.dumps({
            'role': 'teacher',
            'email': 'teacher.test@gmail.com',
            'password': 'teachpass123'
        }).encode(),
        headers={'Content-Type': 'application/json'}
    )
    login_t_res = json.loads(urllib.request.urlopen(login_t_req).read().decode())
    assert login_t_res['success'] == True, 'Teacher login failed'
    print('[+] Teacher Login with Registered Gmail & Password: OK')

    # 7. Test Database Status & Clear
    status_res = json.loads(urllib.request.urlopen(f'{base}/api/database/status').read().decode())
    print(f"[+] Database status checked: {status_res['sqlite']['studentsCount']} students, Firebase configured: {status_res['firebase']['configured']}")

    print('\n>>> ALL REGISTRATION, LOGIN, DATABASE & LEDGER CHECKS PASSED! <<<')

if __name__ == '__main__':
    test_api()
