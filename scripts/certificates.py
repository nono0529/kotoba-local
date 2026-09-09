"""A project-local CA and TLS certificate. Never installs trust on any device."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import ipaddress, json, sys, socket
from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

root=Path(__file__).resolve().parents[1]
dest=root/'.local/certs';dest.mkdir(parents=True,exist_ok=True)
ips=sorted(set(['127.0.0.1',*sys.argv[1:]]))
now=datetime.now(timezone.utc)
def write_key(path,key):path.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
def load_key(path):return serialization.load_pem_private_key(path.read_bytes(),password=None)
ca_path=dest/'root-ca.pem';ca_key_path=dest/'root-ca-key.pem'
if ca_path.exists() and ca_key_path.exists():
    ca=x509.load_pem_x509_certificate(ca_path.read_bytes());ca_key=load_key(ca_key_path)
else:
    ca_key=rsa.generate_private_key(public_exponent=65537,key_size=3072)
    name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Kotoba Local Personal CA')])
    ca=(x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(ca_key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=3650)).add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True).add_extension(x509.KeyUsage(digital_signature=True,key_encipherment=False,key_cert_sign=True,crl_sign=True,content_commitment=False,data_encipherment=False,key_agreement=False,encipher_only=False,decipher_only=False),critical=True).add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()),critical=False).sign(ca_key,hashes.SHA256()))
    write_key(ca_key_path,ca_key);ca_path.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
(dest/'root-ca.cer').write_bytes(ca.public_bytes(serialization.Encoding.DER))
existing=None
if (dest/'server.pem').exists():existing=x509.load_pem_x509_certificate((dest/'server.pem').read_bytes())
valid_ips=[]
if existing:
    valid_ips=[str(v) for v in existing.extensions.get_extension_for_class(x509.SubjectAlternativeName).value.get_values_for_type(x509.IPAddress)]
expires = (existing.not_valid_after_utc if hasattr(existing,'not_valid_after_utc') else existing.not_valid_after.replace(tzinfo=timezone.utc)) if existing else None
if not existing or not set(ips).issubset(valid_ips) or expires<now+timedelta(days=20):
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    cert=(x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Kotoba Local')])).issuer_name(ca.subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=365)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'),x509.DNSName(socket.gethostname()),*[x509.IPAddress(ipaddress.ip_address(ip)) for ip in ips]]),critical=False).add_extension(x509.BasicConstraints(ca=False,path_length=None),critical=True).add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),critical=False).add_extension(x509.KeyUsage(digital_signature=True,key_encipherment=True,key_cert_sign=False,crl_sign=False,content_commitment=False,data_encipherment=False,key_agreement=False,encipher_only=False,decipher_only=False),critical=True).add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),critical=False).sign(ca_key,hashes.SHA256()))
    write_key(dest/'server-key.pem',key);(dest/'server.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
print(json.dumps({'ips':ips,'fingerprint':ca.fingerprint(hashes.SHA256()).hex().upper()},ensure_ascii=True))
