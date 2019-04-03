package dk.sdu.cloud.file.services

import dk.sdu.cloud.file.api.AccessEntry
import dk.sdu.cloud.file.api.FileChecksum
import dk.sdu.cloud.file.api.FileType
import dk.sdu.cloud.file.api.SensitivityLevel
import dk.sdu.cloud.file.api.Timestamps

// This slightly messy code allows us to skip null checks. This makes for a better API
@Suppress("ConstructorParameterNaming")
class FileRow(
    val _fileType: FileType?,
    val _isLink: Boolean?,
    val _linkTarget: String?,
    val _unixMode: Int?,
    val _owner: String?,
    val _group: String?,
    val _timestamps: Timestamps?,
    val _path: String?,
    val _rawPath: String?,
    val _inode: String?,
    val _size: Long?,
    val _shares: List<AccessEntry>?,
    val _sensitivityLevel: SensitivityLevel?,
    val _linkInode: String?,
    val _xowner: String?
) {
    val fileType: FileType get() = _fileType!!
    val isLink: Boolean get() = _isLink!!
    val linkTarget: String get() = _linkTarget!!
    val unixMode: Int get() = _unixMode!!
    val owner: String get() = _owner!!
    val group: String get() = _group!!
    val timestamps: Timestamps get() = _timestamps!!
    val path: String get() = _path!!
    val rawPath: String get() = _rawPath!!
    val inode: String get() = _inode!!
    val size: Long get() = _size!!
    val shares: List<AccessEntry> get() = _shares!!
    val sensitivityLevel: SensitivityLevel? get() = _sensitivityLevel
    val linkInode: String get() = _linkInode!!
    val xowner: String get() = _xowner!!

    override fun toString(): String {
        return "FileRow(" +
                "_fileType=$_fileType, \n" +
                "_isLink=$_isLink, \n" +
                "_linkTarget=$_linkTarget, \n" +
                "_unixMode=$_unixMode, \n" +
                "_owner=$_owner, \n" +
                "_group=$_group, \n" +
                "_timestamps=$_timestamps, \n" +
                "_path=$_path, \n" +
                "_rawPath=$_rawPath, \n" +
                "_inode=$_inode, \n" +
                "_size=$_size, \n" +
                "_shares=$_shares, \n" +
                "_sensitivityLevel=$_sensitivityLevel, \n" +
                "_linkInode=$_linkInode, \n" +
                "_xowner=$_xowner\n" +
                ")"
    }


}


fun Set<FileAttribute>.asBitSet(): Long {
    var result = 0L
    for (item in this) {
        result = result or item.value
    }
    return result
}
