// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title HealthcareRegistry
 * @notice Feature 1.1.A — Entity Registration, RBAC and IDS Quarantine Circuit Breaker.
 * @dev   The deployer is the immutable trusted security authority.
 *        Only the authority may register entities, quarantine devices,
 *        and invoke telemetry checks.
 */
contract HealthcareRegistry {
    // ---------------------------------------------------------------
    //  Custom errors
    // ---------------------------------------------------------------
    error Unauthorized();
    error InvalidAddress();
    error InvalidName();
    error InvalidLicenseHash();
    error InvalidProfileHash();
    error InvalidDeviceId();
    error InvalidSensorMacHash();
    error HospitalAlreadyRegistered(address hospitalAddr);
    error DoctorAlreadyRegistered(address doctorAddr);
    error PatientAlreadyRegistered(address patientAddr);
    error DeviceAlreadyRegistered(bytes32 deviceId);
    error PatientNotRegistered(address patientAddr);
    error DeviceNotRegistered(bytes32 deviceId);
    error DeviceAlreadyQuarantined(bytes32 deviceId);
    error ConfidenceTooHigh(uint256 confidenceBps);
    error ConfidenceBelowThreshold(uint256 confidenceBps);

    // ---------------------------------------------------------------
    //  Events
    // ---------------------------------------------------------------
    event EntityRegistered(
        string entityType,
        address indexed entityAddr,
        uint256 timestamp
    );

    event DeviceRegistered(
        bytes32 indexed deviceId,
        address indexed ownerPatient,
        bytes32 sensorMacHash,
        uint256 timestamp
    );

    event DeviceQuarantined(
        bytes32 indexed deviceId,
        string attackType,
        uint256 confidenceBps,
        uint256 timestamp
    );

    event UnauthorizedTelemetryBlocked(
        bytes32 indexed deviceId,
        address indexed caller,
        uint256 totalBlockedAttempts
    );

    // ---------------------------------------------------------------
    //  Structs
    // ---------------------------------------------------------------
    struct Hospital {
        address hospitalAddr;
        string name;
        uint256 registeredAt;
        bool isRegistered;
    }

    struct Doctor {
        address doctorAddr;
        string licenseHash;
        uint256 registeredAt;
        bool isRegistered;
    }

    struct Patient {
        address patientAddr;
        bytes32 profileHash;
        uint256 registeredAt;
        bool isRegistered;
    }

    struct IoTDevice {
        bytes32 deviceId;
        address ownerPatient;
        bytes32 sensorMacHash;
        uint256 registeredAt;
        bool isRegistered;
    }

    // ---------------------------------------------------------------
    //  State variables
    // ---------------------------------------------------------------
    address public immutable trustedAuthority;

    mapping(address => Hospital) public hospitals;
    mapping(address => Doctor) public doctors;
    mapping(address => Patient) public patients;
    mapping(bytes32 => IoTDevice) public devices;

    mapping(bytes32 => bool) public isDeviceQuarantined;
    mapping(bytes32 => string) public quarantineReason;
    uint256 public blockedUnauthorizedAttempts;

    // ---------------------------------------------------------------
    //  Modifiers
    // ---------------------------------------------------------------
    modifier onlyAuthority() {
        if (msg.sender != trustedAuthority) revert Unauthorized();
        _;
    }

    // ---------------------------------------------------------------
    //  Constructor
    // ---------------------------------------------------------------
    constructor() {
        trustedAuthority = msg.sender;
    }

    // ---------------------------------------------------------------
    //  Registration functions
    // ---------------------------------------------------------------

    /**
     * @notice Register a hospital.  Authority-only, rejects zero address,
     *         empty name and duplicates.
     */
    function registerHospital(
        address hospitalAddr,
        string calldata name
    ) external onlyAuthority {
        if (hospitalAddr == address(0)) revert InvalidAddress();
        if (bytes(name).length == 0) revert InvalidName();
        if (hospitals[hospitalAddr].isRegistered)
            revert HospitalAlreadyRegistered(hospitalAddr);

        hospitals[hospitalAddr] = Hospital({
            hospitalAddr: hospitalAddr,
            name: name,
            registeredAt: block.timestamp,
            isRegistered: true
        });

        emit EntityRegistered("Hospital", hospitalAddr, block.timestamp);
    }

    /**
     * @notice Register a doctor.  Authority-only, rejects zero address,
     *         empty licenseHash and duplicates.
     */
    function registerDoctor(
        address doctorAddr,
        string calldata licenseHash
    ) external onlyAuthority {
        if (doctorAddr == address(0)) revert InvalidAddress();
        if (bytes(licenseHash).length == 0) revert InvalidLicenseHash();
        if (doctors[doctorAddr].isRegistered)
            revert DoctorAlreadyRegistered(doctorAddr);

        doctors[doctorAddr] = Doctor({
            doctorAddr: doctorAddr,
            licenseHash: licenseHash,
            registeredAt: block.timestamp,
            isRegistered: true
        });

        emit EntityRegistered("Doctor", doctorAddr, block.timestamp);
    }

    /**
     * @notice Register a patient.  Authority-only, rejects zero address,
     *         zero profileHash and duplicates.
     */
    function registerPatient(
        address patientAddr,
        bytes32 profileHash
    ) external onlyAuthority {
        if (patientAddr == address(0)) revert InvalidAddress();
        if (profileHash == bytes32(0)) revert InvalidProfileHash();
        if (patients[patientAddr].isRegistered)
            revert PatientAlreadyRegistered(patientAddr);

        patients[patientAddr] = Patient({
            patientAddr: patientAddr,
            profileHash: profileHash,
            registeredAt: block.timestamp,
            isRegistered: true
        });

        emit EntityRegistered("Patient", patientAddr, block.timestamp);
    }

    /**
     * @notice Register an IoT device.  Authority-only.
     *         Rejects zero deviceId, zero sensorMacHash, and duplicates.
     *         The ownerPatient must already be registered as a Patient.
     */
    function registerIoTDevice(
        bytes32 deviceId,
        address patientAddr,
        bytes32 sensorMacHash
    ) external onlyAuthority {
        if (deviceId == bytes32(0)) revert InvalidDeviceId();
        if (sensorMacHash == bytes32(0)) revert InvalidSensorMacHash();
        if (!patients[patientAddr].isRegistered)
            revert PatientNotRegistered(patientAddr);
        if (devices[deviceId].isRegistered)
            revert DeviceAlreadyRegistered(deviceId);

        devices[deviceId] = IoTDevice({
            deviceId: deviceId,
            ownerPatient: patientAddr,
            sensorMacHash: sensorMacHash,
            registeredAt: block.timestamp,
            isRegistered: true
        });

        emit DeviceRegistered(
            deviceId,
            patientAddr,
            sensorMacHash,
            block.timestamp
        );
    }

    // ---------------------------------------------------------------
    //  IDS Quarantine Circuit Breaker
    // ---------------------------------------------------------------

    /**
     * @notice Quarantine a registered IoT device.
     * @param deviceId      The device identifier.
     * @param attackType    Human-readable attack classification string.
     * @param confidenceBps Confidence in basis points (10 000 = 100 %).
     *                      Must be ≤ 10 000 and strictly > 8 500 to trigger quarantine.
     */
    function quarantineDevice(
        bytes32 deviceId,
        string calldata attackType,
        uint256 confidenceBps
    ) external onlyAuthority {
        if (!devices[deviceId].isRegistered)
            revert DeviceNotRegistered(deviceId);
        if (isDeviceQuarantined[deviceId])
            revert DeviceAlreadyQuarantined(deviceId);
        if (confidenceBps > 10_000)
            revert ConfidenceTooHigh(confidenceBps);
        if (confidenceBps <= 8_500)
            revert ConfidenceBelowThreshold(confidenceBps);

        isDeviceQuarantined[deviceId] = true;
        quarantineReason[deviceId] = attackType;

        emit DeviceQuarantined(
            deviceId,
            attackType,
            confidenceBps,
            block.timestamp
        );
    }

    // ---------------------------------------------------------------
    //  Telemetry check
    // ---------------------------------------------------------------

    /**
     * @notice Check whether a device is allowed to submit telemetry.
     * @dev    - Reverts for unregistered devices.
     *         - Returns true  for registered, non-quarantined devices.
     *         - Returns false for quarantined devices, incrementing
     *           `blockedUnauthorizedAttempts` and emitting
     *           `UnauthorizedTelemetryBlocked`.  Does NOT revert so that
     *           the counter and event persist on-chain.
     */
    function recordDeviceTelemetryCheck(
        bytes32 deviceId
    ) external onlyAuthority returns (bool) {
        if (!devices[deviceId].isRegistered)
            revert DeviceNotRegistered(deviceId);

        if (isDeviceQuarantined[deviceId]) {
            blockedUnauthorizedAttempts += 1;

            emit UnauthorizedTelemetryBlocked(
                deviceId,
                msg.sender,
                blockedUnauthorizedAttempts
            );

            return false;
        }

        return true;
    }
}

